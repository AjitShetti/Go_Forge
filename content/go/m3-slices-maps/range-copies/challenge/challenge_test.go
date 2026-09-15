package main

import (
	"fmt"
	"testing"
)

func TestPromote(t *testing.T) {
	cases := []struct {
		name      string
		team      []Employee
		promote   string
		wantFound bool
		wantTeam  []Employee
	}{
		{"nobody", nil, "ana", false, nil},
		{"not found", []Employee{{"ana", 1}}, "bo", false, []Employee{{"ana", 1}}},
		{"one match", []Employee{{"ana", 1}, {"bo", 2}}, "bo", true, []Employee{{"ana", 1}, {"bo", 3}}},
		{"first element", []Employee{{"ana", 1}, {"bo", 2}}, "ana", true, []Employee{{"ana", 2}, {"bo", 2}}},
		{"everyone with the name", []Employee{{"sam", 1}, {"kim", 4}, {"sam", 5}}, "sam", true, []Employee{{"sam", 2}, {"kim", 4}, {"sam", 6}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			before := fmt.Sprint(c.team)
			found := Promote(c.team, c.promote)
			if found != c.wantFound {
				t.Errorf("Promote(%s, %q) returned %v, want %v", before, c.promote, found, c.wantFound)
			}
			if fmt.Sprint(c.team) != fmt.Sprint(c.wantTeam) {
				t.Errorf("after Promote(%s, %q) team is %v, want %v", before, c.promote, c.team, c.wantTeam)
			}
		})
	}
}
