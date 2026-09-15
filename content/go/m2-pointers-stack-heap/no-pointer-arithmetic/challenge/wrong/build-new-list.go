package main

type Node struct {
	Val  int
	Next *Node
}

// Right values, but every node is new: the caller's nodes are untouched.
func Reverse(head *Node) *Node {
	var out *Node
	for n := head; n != nil; n = n.Next {
		out = &Node{Val: n.Val, Next: out}
	}
	return out
}
