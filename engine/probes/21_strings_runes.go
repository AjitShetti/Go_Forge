package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	s := "héllo, 世界"
	fmt.Println(len(s), utf8.RuneCountInString(s))
	fmt.Println(s[1], string(s[1]))
	for i, r := range "hé" {
		fmt.Println(i, r, string(r))
	}
	b := []byte("abc")
	fmt.Println(b, []rune("é"))
}
