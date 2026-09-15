package main

import "testing"

// build links nodes for vals and also returns them in order.
func build(vals []int) (*Node, []*Node) {
	nodes := make([]*Node, len(vals))
	for i, v := range vals {
		nodes[i] = &Node{Val: v}
	}
	for i := 0; i+1 < len(nodes); i++ {
		nodes[i].Next = nodes[i+1]
	}
	if len(nodes) == 0 {
		return nil, nil
	}
	return nodes[0], nodes
}

func TestReverse(t *testing.T) {
	cases := []struct {
		name string
		vals []int
	}{
		{"empty", nil},
		{"one", []int{1}},
		{"two", []int{1, 2}},
		{"five", []int{1, 2, 3, 4, 5}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			head, nodes := build(c.vals)
			got := Reverse(head)
			i := len(nodes) - 1
			for n := got; n != nil; n = n.Next {
				if i < 0 {
					t.Fatalf("reversed list is longer than %d nodes", len(nodes))
				}
				if n != nodes[i] {
					t.Fatalf("position %d: got a node with value %d at a different address; Reverse must relink the original nodes", len(nodes)-1-i, n.Val)
				}
				i--
			}
			if i != -1 {
				t.Fatalf("reversed list has %d nodes, want %d", len(nodes)-1-i, len(nodes))
			}
		})
	}
}
