package main

type Node struct {
	Val  int
	Next *Node
}

// Overwrites head.Next before remembering where the rest of the list was.
func Reverse(head *Node) *Node {
	var prev *Node
	for head != nil {
		head.Next = prev
		prev = head
		head = head.Next
	}
	return prev
}
