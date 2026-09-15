package main

import "fmt"

type Logger struct {
	prefix string
}

func (l Logger) Log(msg string) {
	fmt.Println(l.prefix + msg)
}

func (l Logger) Info(msg string) {
	l.Log("INFO " + msg)
}

type AuditLogger struct {
	Logger
}

func (a AuditLogger) Log(msg string) {
	fmt.Println("[audit] " + msg)
}

func main() {
	a := AuditLogger{Logger{prefix: "app: "}}
	a.Log("started")
	a.Info("ready")
}
