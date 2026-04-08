//go:build !windows

package service

import "os/exec"

func configureBackgroundCommand(cmd *exec.Cmd) {
}
