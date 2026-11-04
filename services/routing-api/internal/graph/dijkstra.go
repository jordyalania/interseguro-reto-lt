// Package graph calcula rutas mínimas. No depende de HTTP ni de ningún distrito concreto:
// la red llega como dato, así que puede cambiar sin tocar el algoritmo.
package graph

import (
	"container/heap"
	"errors"
	"fmt"
	"math"
	"slices"
)

// Graph es una lista de adyacencia dirigida: origen -> destino -> distancia.
type Graph map[string]map[string]float64

// Route es la ruta más corta desde la base elegida hasta el siniestro.
type Route struct {
	FromDepot string   `json:"fromDepot"`
	To        string   `json:"to"`
	Path      []string `json:"path"`
	Distance  float64  `json:"distance"`
}

var (
	// ErrInvalidInput agrupa los errores causados por datos de entrada incorrectos.
	ErrInvalidInput = errors.New("entrada inválida")
	// ErrUnreachable indica que ninguna base puede llegar al siniestro.
	ErrUnreachable = errors.New("ubicación no alcanzable desde ninguna base")
)

type edge struct {
	to     string
	weight float64
}

// label guarda el mejor resultado conocido para un nodo.
type label struct {
	distance float64
	depot    string
	previous string
}

// FindNearest ejecuta Dijkstra multiorigen: todas las bases entran a la cola con distancia 0,
// así una sola pasada encuentra la más cercana. Complejidad: O((V+E) log V).
//
// Los empates son deterministas: gana la base con el nombre alfabéticamente menor.
func FindNearest(g Graph, accident string, depots []string) (Route, error) {
	adjacency, err := buildAdjacency(g)
	if err != nil {
		return Route{}, err
	}
	sources, err := validateEndpoints(adjacency, accident, depots)
	if err != nil {
		return Route{}, err
	}

	best := make(map[string]label, len(adjacency))
	queue := &priorityQueue{}
	for _, depot := range sources {
		best[depot] = label{distance: 0, depot: depot}
		heap.Push(queue, queueItem{node: depot, distance: 0, depot: depot})
	}

	for queue.Len() > 0 {
		current := heap.Pop(queue).(queueItem)
		known := best[current.node]
		// Entrada vieja: el nodo ya se mejoró después de encolarla.
		if current.distance != known.distance || current.depot != known.depot {
			continue
		}
		if current.node == accident {
			return Route{
				FromDepot: known.depot,
				To:        accident,
				Path:      rebuildPath(best, accident),
				Distance:  known.distance,
			}, nil
		}
		for _, next := range adjacency[current.node] {
			candidate := label{
				distance: current.distance + next.weight,
				depot:    current.depot,
				previous: current.node,
			}
			if existing, seen := best[next.to]; !seen || isBetter(candidate, existing) {
				best[next.to] = candidate
				heap.Push(queue, queueItem{node: next.to, distance: candidate.distance, depot: candidate.depot})
			}
		}
	}

	return Route{}, fmt.Errorf("%w: %q", ErrUnreachable, accident)
}

func isBetter(a, b label) bool {
	if a.distance != b.distance {
		return a.distance < b.distance
	}
	return a.depot < b.depot
}

// buildAdjacency valida los pesos y ordena los vecinos para que el resultado no dependa
// del orden aleatorio de los mapas de Go.
func buildAdjacency(g Graph) (map[string][]edge, error) {
	if len(g) == 0 {
		return nil, fmt.Errorf("%w: el grafo está vacío", ErrInvalidInput)
	}

	adjacency := make(map[string][]edge, len(g))
	for from, neighbors := range g {
		if from == "" {
			return nil, fmt.Errorf("%w: el grafo tiene un nodo sin nombre", ErrInvalidInput)
		}
		edges := make([]edge, 0, len(neighbors))
		for to, weight := range neighbors {
			if to == "" {
				return nil, fmt.Errorf("%w: %q tiene un vecino sin nombre", ErrInvalidInput, from)
			}
			if weight < 0 || math.IsNaN(weight) || math.IsInf(weight, 0) {
				return nil, fmt.Errorf("%w: distancia inválida entre %q y %q", ErrInvalidInput, from, to)
			}
			edges = append(edges, edge{to: to, weight: weight})
			if _, known := adjacency[to]; !known {
				adjacency[to] = nil
			}
		}
		slices.SortFunc(edges, func(a, b edge) int {
			if a.to < b.to {
				return -1
			}
			if a.to > b.to {
				return 1
			}
			return 0
		})
		adjacency[from] = edges
	}
	return adjacency, nil
}

func validateEndpoints(adjacency map[string][]edge, accident string, depots []string) ([]string, error) {
	if accident == "" {
		return nil, fmt.Errorf("%w: falta la ubicación del accidente", ErrInvalidInput)
	}
	if _, known := adjacency[accident]; !known {
		return nil, fmt.Errorf("%w: %q no existe en el grafo", ErrInvalidInput, accident)
	}
	if len(depots) == 0 {
		return nil, fmt.Errorf("%w: debe indicar al menos una base", ErrInvalidInput)
	}

	sources := slices.Clone(depots)
	slices.Sort(sources)
	sources = slices.Compact(sources)
	for _, depot := range sources {
		if _, known := adjacency[depot]; !known {
			return nil, fmt.Errorf("%w: la base %q no existe en el grafo", ErrInvalidInput, depot)
		}
	}
	return sources, nil
}

func rebuildPath(best map[string]label, target string) []string {
	path := []string{target}
	for node := target; best[node].previous != ""; {
		node = best[node].previous
		path = append(path, node)
	}
	slices.Reverse(path)
	return path
}

type queueItem struct {
	node     string
	distance float64
	depot    string
}

type priorityQueue []queueItem

func (q priorityQueue) Len() int { return len(q) }

func (q priorityQueue) Less(i, j int) bool {
	if q[i].distance != q[j].distance {
		return q[i].distance < q[j].distance
	}
	if q[i].depot != q[j].depot {
		return q[i].depot < q[j].depot
	}
	return q[i].node < q[j].node
}

func (q priorityQueue) Swap(i, j int) { q[i], q[j] = q[j], q[i] }

func (q *priorityQueue) Push(item any) { *q = append(*q, item.(queueItem)) }

func (q *priorityQueue) Pop() any {
	old := *q
	last := len(old) - 1
	item := old[last]
	*q = old[:last]
	return item
}
