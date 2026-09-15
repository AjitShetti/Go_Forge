package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	p := NewPool(2)
	for i := 1; i <= 5; i++ {
		p.Submit(func() { time.Sleep(10 * time.Millisecond) })
	}
	p.Shutdown()
	fmt.Println("processed:", p.Processed())
}

// Pool runs submitted jobs on a fixed number of workers.
type Pool struct {
	jobs      chan func()
	wg        sync.WaitGroup
	processed atomic.Int32
}

func NewPool(workers int) *Pool {
	p := &Pool{jobs: make(chan func(), 16)}
	for range workers {
		p.wg.Go(func() {
			for job := range p.jobs {
				job()
				p.processed.Add(1)
			}
		})
	}
	return p
}

func (p *Pool) Submit(job func()) { p.jobs <- job }

func (p *Pool) Processed() int32 { return p.processed.Load() }

// Shutdown stops accepting jobs. Jobs already submitted must still run, and
// Shutdown must return only after they have.
func (p *Pool) Shutdown() {
	close(p.jobs)
	p.wg.Wait()
}
