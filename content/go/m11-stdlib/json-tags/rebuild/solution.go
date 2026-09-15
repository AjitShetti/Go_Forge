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
	// Decoding into any, JSON numbers become float64 and JSON arrays become
	// []any: the decoder has no type to aim for, so it uses the most general ones.
	id, ok := p["id"].(float64)
	if !ok {
		return "no id"
	}
	tags, _ := p["tags"].([]any)
	return fmt.Sprintf("id=%d tags=%d", int(id), len(tags))
}
