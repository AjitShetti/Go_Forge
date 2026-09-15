package main

// Node is one element of a singly linked list.
type Node struct {
	Val  int
	Next *Node
}

// Reverse reverses the list starting at head by relinking its nodes, and
// returns the new head. It must reuse the existing nodes, not create new ones.
func Reverse(head *Node) *Node {
	return head
}
