package main

type Employee struct {
	Name  string
	Level int
}

// Writes the copy back correctly, but returns after the first match.
func Promote(team []Employee, name string) bool {
	for i, e := range team {
		if e.Name == name {
			e.Level++
			team[i] = e
			return true
		}
	}
	return false
}
