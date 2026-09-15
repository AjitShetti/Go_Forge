package main

import (
	"encoding/json"
	"fmt"
)

func main() {
	var payload map[string]any
	err := json.Unmarshal([]byte(`{"id": 42, "tags": ["a", "b"]}`), &payload)
	fmt.Println(err)
	fmt.Println(describe(payload))
}

// describe summarizes a decoded payload as "id=<id> tags=<count>".
func describe(p map[string]any) string {
	id, ok := p["id"].(int)
	if !ok {
		return "no id"
	}
	tags, _ := p["tags"].([]string)
	return fmt.Sprintf("id=%d tags=%d", id, len(tags))
}
