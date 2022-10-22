# FigJam Force Directed Graph

No dependencies, just a simple animated force directed graph based on the [Fruchterman Reingold Algorithm](https://en.wikipedia.org/wiki/Force-directed_graph_drawing).

Inspired by [graphview](https://github.com/nabil6391/graphview) for [Flutter](https://flutter.dev/).

## Usage

Given the following graph data:

```json
{
  "nodes": [
    { "id": "1" },
    { "id": "2" },
    { "id": "3" },
    { "id": "4" },
    { "id": "5" },
  ],
  "edges": [
    { "source": "1", "destination": "2" },
    { "source": "1", "destination": "3" },
    { "source": "2", "destination": "4" },
    { "source": "2", "destination": "5" },
    { "source": "3", "destination": "4" },
    { "source": "3", "destination": "5" },
  ],
}
```

Will render the following graph:

![](/screenshots/graph.png)

With the following plugin UI:

![](/screenshots/plugin.png)

## Development

```bash
# Install dependencies
npm install

# Run the development server
npm run watch

# Build the plugin
npm run build
```
