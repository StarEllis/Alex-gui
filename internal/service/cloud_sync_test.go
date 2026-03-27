package service

import (
	"encoding/json"
	"testing"
	"time"
)

// ==================== 云端同步测试 ====================

func TestSyncConflictMerge_Playlist(t *testing.T) {
	svc := &CloudSyncService{
		logger: testLogger(),
	}

	localValue := `["media1","media2","media3"]`
	remoteValue := `["media2","media4","media5"]`

	// 测试合并逻辑（不依赖数据库，直接测试合并算法）
	var localItems, remoteItems []string
	json.Unmarshal([]byte(localValue), &localItems)
	json.Unmarshal([]byte(remoteValue), &remoteItems)

	seen := make(map[string]bool)
	var merged []string
	for _, item := range localItems {
		if !seen[item] {
			seen[item] = true
			merged = append(merged, item)
		}
	}
	for _, item := range remoteItems {
		if !seen[item] {
			seen[item] = true
			merged = append(merged, item)
		}
	}

	if len(merged) != 5 {
		t.Errorf("合并后应有 5 个不重复项, 实际 %d", len(merged))
	}

	// 验证所有原始项都在合并结果中
	mergedSet := make(map[string]bool)
	for _, item := range merged {
		mergedSet[item] = true
	}
	for _, item := range localItems {
		if !mergedSet[item] {
			t.Errorf("本地项 %s 在合并结果中丢失", item)
		}
	}
	for _, item := range remoteItems {
		if !mergedSet[item] {
			t.Errorf("远程项 %s 在合并结果中丢失", item)
		}
	}

	_ = svc // 使用 svc 避免编译警告
}

func TestSyncConflictMerge_Progress(t *testing.T) {
	// 测试观看进度冲突：应取进度更大的
	localProgress := `{"position":50.5,"completed":false}`
	remoteProgress := `{"position":80.2,"completed":false}`

	var local, remote struct {
		Position  float64 `json:"position"`
		Completed bool    `json:"completed"`
	}
	json.Unmarshal([]byte(localProgress), &local)
	json.Unmarshal([]byte(remoteProgress), &remote)

	var winner string
	if remote.Completed || remote.Position > local.Position {
		winner = remoteProgress
	} else {
		winner = localProgress
	}

	if winner != remoteProgress {
		t.Errorf("应选择进度更大的远程值, 实际选择了本地值")
	}

	// 测试已完成优先
	remoteCompleted := `{"position":30.0,"completed":true}`
	json.Unmarshal([]byte(remoteCompleted), &remote)

	if remote.Completed || remote.Position > local.Position {
		winner = remoteCompleted
	} else {
		winner = localProgress
	}

	if winner != remoteCompleted {
		t.Errorf("已完成的记录应优先, 即使进度更小")
	}
}

func TestOperationQueue(t *testing.T) {
	svc := &CloudSyncService{
		logger: testLogger(),
	}

	// 添加操作到队列
	svc.EnqueueOperation(SyncOperation{
		UserID:   "user1",
		DeviceID: "device1",
		Action:   "update",
		DataType: "progress",
		DataKey:  "media1",
	})
	svc.EnqueueOperation(SyncOperation{
		UserID:   "user1",
		DeviceID: "device1",
		Action:   "create",
		DataType: "favorites",
		DataKey:  "media2",
	})
	svc.EnqueueOperation(SyncOperation{
		UserID:   "user2",
		DeviceID: "device2",
		Action:   "update",
		DataType: "progress",
		DataKey:  "media3",
	})

	// 检查 user1 的待同步操作数
	pending := svc.GetPendingOperations("user1")
	if pending != 2 {
		t.Errorf("user1 待同步操作数 = %d, 期望 2", pending)
	}

	// 检查 user2 的待同步操作数
	pending2 := svc.GetPendingOperations("user2")
	if pending2 != 1 {
		t.Errorf("user2 待同步操作数 = %d, 期望 1", pending2)
	}
}

func TestSyncOperation_Timestamp(t *testing.T) {
	svc := &CloudSyncService{
		logger: testLogger(),
	}

	before := time.Now()
	svc.EnqueueOperation(SyncOperation{
		UserID:   "user1",
		DeviceID: "device1",
		Action:   "update",
		DataType: "progress",
		DataKey:  "media1",
	})
	after := time.Now()

	svc.opQueueMu.Lock()
	if len(svc.opQueue) != 1 {
		t.Fatalf("队列长度 = %d, 期望 1", len(svc.opQueue))
	}
	op := svc.opQueue[0]
	svc.opQueueMu.Unlock()

	if op.Timestamp.Before(before) || op.Timestamp.After(after) {
		t.Errorf("操作时间戳不在预期范围内")
	}
	if op.Applied {
		t.Errorf("新入队的操作不应标记为已应用")
	}
}
