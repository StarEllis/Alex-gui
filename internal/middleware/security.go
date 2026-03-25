package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Security 安全头中间件
func Security() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// CSP: 允许自身、blob、data URI（视频播放需要）
		c.Header("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'unsafe-inline' 'unsafe-eval'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob: https:; "+
				"media-src 'self' blob:; "+
				"connect-src 'self' ws: wss:; "+
				"font-src 'self' data:;")

		c.Next()
	}
}

// RateLimit 速率限制中间件（简单令牌桶）
func RateLimit(maxRequestsPerMinute int) gin.HandlerFunc {
	type visitor struct {
		tokens    int
		lastReset time.Time
	}

	visitors := make(map[string]*visitor)

	return func(c *gin.Context) {
		ip := c.ClientIP()

		v, exists := visitors[ip]
		if !exists || time.Since(v.lastReset) > time.Minute {
			visitors[ip] = &visitor{tokens: maxRequestsPerMinute, lastReset: time.Now()}
			v = visitors[ip]
		}

		if v.tokens <= 0 {
			c.Header("Retry-After", "60")
			c.AbortWithStatus(429)
			return
		}

		v.tokens--
		c.Next()
	}
}

// RequestID 请求 ID 中间件
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)
		c.Next()
	}
}

// generateRequestID 生成简单的请求 ID
func generateRequestID() string {
	return strings.Replace(
		time.Now().Format("20060102150405.000000"),
		".", "", 1,
	)
}
