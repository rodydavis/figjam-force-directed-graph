/*
 Copyright 2016 Google Inc. All rights reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

// -- Graph Render --

const DEFAULT_ITERATIONS = 1000;
const REPULSION_RATE = 0.5;
const REPULSION_PERCENTAGE = 0.4;
const ATTRACTION_RATE = 0.15;
const ATTRACTION_PERCENTAGE = 0.15;
const CLUSTER_PADDING = 15;
const EPSILON = 0.0001;
const DEFAULT_NODE_SIZE = 100;

interface Size {
  width: number;
  height: number;
}

class Node {
  id: string;
  name?: string;
  position: Offset = Offset.zero;
  width: number = DEFAULT_NODE_SIZE;
  height: number = DEFAULT_NODE_SIZE;

  constructor(id: string) {
    this.id = id;
  }

  get x() {
    return this.position.x;
  }

  get y() {
    return this.position.y;
  }
}

interface Edge {
  source: Node;
  destination: Node;
  name?: string;
}

class Graph {
  constructor(public nodes: Node[], public edges: Edge[]) { }

  static fromJson(data: {
    nodes: { id: string }[],
    edges: { source: string, destination: string }[],
    properties?: { [key: string]: any }
  }) {
    const nodes = data.nodes.map(n => {
      const node = new Node(n.id);
      if (data.properties?.defaultNodeSize) {
        const size = Number(data.properties.defaultNodeSize);
        node.width = node.height = size;
      }
      return node;
    });

    const edges = data.edges.map(e => ({
      source: nodes.find(n => n.id === e.source)!,
      destination: nodes.find(n => n.id === e.destination)!
    }));

    return new Graph(nodes, edges);
  }

  toJson() {
    return {
      nodes: this.nodes.map(n => ({ id: n.id })),
      edges: this.edges.map(e => ({
        source: e.source.id,
        destination: e.destination.id
      }))
    };
  };

  successorsOf(node: Node): Node[] {
    return this.getOutEdges(node).map(e => e.destination);
  }

  getOutEdges(node: Node): Edge[] {
    return this.edges.filter(e => e.source === node);
  }

  predecessorsOf(node: Node): Node[] {
    return this.getInEdges(node).map(e => e.source);
  }

  getInEdges(node: Node): Edge[] {
    return this.edges.filter(e => e.destination === node);
  }

  getEdgeBetween(source: Node, destination: Node): Edge | undefined {
    return this.edges.find(e => e.source === source && e.destination === destination);
  }

  hasNodes() {
    return this.nodes.length > 0;
  }
}

class Offset {
  constructor(readonly x: number, readonly y: number) { }
  static zero = new Offset(0, 0);

  add(offset: Offset): Offset {
    return new Offset(this.x + offset.x, this.y + offset.y);
  }

  subtract(offset: Offset): Offset {
    return new Offset(this.x - offset.x, this.y - offset.y);
  }

  divide(divisor: number): Offset {
    return new Offset(this.x / divisor, this.y / divisor);
  }


  public get distance(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }


  limit(max: number): Offset {
    const distance = this.distance;
    if (distance > max) {
      return this.divide(distance).multiply(max);
    }
    return this;
  }

  multiply(multiplier: number): Offset {
    return new Offset(this.x * multiplier, this.y * multiplier);
  }
}


class Rect {
  constructor(readonly x: number, readonly y: number, readonly width: number, readonly height: number) { }

  static fromLTRB(left: number, top: number, right: number, bottom: number): Rect {
    return new Rect(left, top, right - left, bottom - top);
  }

  static zero = new Rect(0, 0, 0, 0);

  get left(): number {
    return this.x;
  }

  get top(): number {
    return this.y;
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  translate(x: number, y: number): Rect {
    return new Rect(this.x + x, this.y + y, this.width, this.height);
  }
}

class Random {
  nextDouble() {
    return Math.random();
  }
}

// Fruchterman Reingold Algorithm
class ForceDirectedGraph {
  displacement = new Map<Node, Offset>();
  random = new Random();
  graphHeight = 500;
  graphWidth = 500;
  tick = 0;

  iterations = DEFAULT_ITERATIONS;
  repulsionRate = REPULSION_RATE;
  attractionRate = ATTRACTION_RATE;
  repulsionPercentage = REPULSION_PERCENTAGE;
  attractionPercentage = ATTRACTION_PERCENTAGE;

  focusedNode: Node | null = null;

  setProperties(options: { [key: string]: any }) {
    if (options?.iterations) this.iterations = options.iterations;
    if (options?.repulsionRate) this.repulsionRate = options.repulsionRate;
    if (options?.attractionRate) this.attractionRate = options.attractionRate;
    if (options?.repulsionPercentage) this.repulsionPercentage = options.repulsionPercentage;
    if (options?.attractionPercentage) this.attractionPercentage = options.attractionPercentage;
  }

  init(graph: Graph) {
    graph.nodes.forEach((node) => {
      this.displacement.set(node, Offset.zero);
      const x = this.random.nextDouble() * this.graphWidth;
      const y = this.random.nextDouble() * this.graphHeight;
      node.position = new Offset(x, y);
    });
  }

  step(graph: Graph) {
    this.displacement.clear();
    graph.nodes.forEach((node) => {
      this.displacement.set(node, Offset.zero);
    });
    this.calculateRepulsion(graph.nodes);
    this.calculateAttraction(graph.edges);
    this.moveNodes(graph);
  }

  moveNodes(graph: Graph) {
    graph.nodes.forEach((node) => {
      const newPosition = node.position.add(this.displacement.get(node)!);
      const newDX = Math.min(this.graphWidth - 40, Math.max(0, newPosition.x));
      const newDY = Math.min(this.graphHeight - 40, Math.max(0, newPosition.y));
      node.position = new Offset(newDX, newDY);
    });
  }

  cool(currentIteration: number) {
    this.tick *= 1 - currentIteration / this.iterations;
  }

  limitMaximumDisplacement(nodes: Node[]) {
    nodes.forEach((node) => {
      if (node !== this.focusedNode) {
        debugger;
        const target = this.displacement.get(node)!;
        const dist = target.distance;
        const displacementLength = Math.max(EPSILON, dist);
        const displacementAmount = displacementLength * Math.min(displacementLength, this.tick);
        const delta = target.divide(displacementAmount);
        node.position = node.position.add(delta);
      } else {
        this.displacement.set(node, Offset.zero);
      }
    });
  }

  calculateAttraction(edges: Edge[]) {
    edges.forEach((edge) => {
      const source = edge.source;
      const destination = edge.destination;
      const delta = source.position.subtract(destination.position);
      const deltaDistance = Math.max(EPSILON, delta.distance);
      const maxAttractionDistance = Math.min(this.graphWidth * this.attractionPercentage, this.graphHeight * this.attractionPercentage);
      const attractionForce = Math.min(0, Math.abs(maxAttractionDistance - deltaDistance) / (maxAttractionDistance * 2));
      const attractionVector = delta.multiply(attractionForce * this.attractionRate);

      this.displacement.set(source, this.displacement.get(source)!.subtract(attractionVector));
      this.displacement.set(destination, this.displacement.get(destination)!.add(attractionVector));
    });
  }

  calculateRepulsion(nodes: Node[]) {
    nodes.forEach((nodeA) => {
      nodes.forEach((nodeB) => {
        if (nodeA !== nodeB) {
          const delta = nodeA.position.subtract(nodeB.position);
          const deltaDistance = Math.max(EPSILON, delta.distance); // Protect for 0
          const maxRepulsionDistance = Math.min(this.graphWidth * this.repulsionPercentage, this.graphHeight * this.repulsionPercentage);
          const repulsionForce = Math.max(0, maxRepulsionDistance - deltaDistance) / maxRepulsionDistance; // Value between 0 and 1
          const repulsionVector = delta.multiply(repulsionForce * this.repulsionRate);

          this.displacement.set(nodeA, this.displacement.get(nodeA)!.add(repulsionVector));
        }
      });

      nodes.forEach((nodeA) => {
        this.displacement.set(nodeA, this.displacement.get(nodeA)!.divide(nodes.length));
      });
    });
  }

  layout(graph: Graph) {
    const size = this.findBiggestSize(graph) * graph.nodes.length;
    this.graphWidth = size;
    this.graphHeight = size;
  }

  run(graph: Graph, shiftX: number, shiftY: number): Size {
    this.layout(graph);

    const nodes = graph.nodes;
    const edges = graph.edges;

    this.tick = 0.1 * Math.sqrt(this.graphWidth / 2 * this.graphHeight / 2);

    this.init(graph);

    for (let i = 0; i < this.iterations; i++) {
      this.calculateRepulsion(nodes);
      this.calculateAttraction(edges);
      this.limitMaximumDisplacement(nodes);

      this.cool(i);

      if (this.done()) {
        break;
      }
    }

    if (this.focusedNode === null) {
      this.positionNodes(graph);
    }

    this.shiftCoordinates(graph, shiftX, shiftY);

    return this.calculateGraphSize(graph);
  }

  shiftCoordinates(graph: Graph, shiftX: number, shiftY: number) {
    graph.nodes.forEach((node) => {
      node.position = node.position.add(new Offset(shiftX, shiftY));
    });
  }

  positionNodes(graph: Graph) {
    const offset = this.getOffset(graph);
    const x = offset.x;
    const y = offset.y;
    const nodesVisited: Node[] = [];
    const nodeClusters: NodeCluster[] = [];
    graph.nodes.forEach((node) => {
      node.position = node.position.subtract(new Offset(x, y));
    });

    graph.nodes.forEach((node) => {
      if (!nodesVisited.includes(node)) {
        nodesVisited.push(node);
        let cluster = this.findClusterOf(nodeClusters, node);
        if (cluster === null) {
          cluster = new NodeCluster();
          cluster.add(node);
          nodeClusters.push(cluster);
        }

        this.followEdges(graph, cluster, node, nodesVisited);
      }
    });

    this.positionCluster(nodeClusters);
  }

  positionCluster(nodeClusters: NodeCluster[]) {
    this.combineSingleNodeCluster(nodeClusters);

    let cluster = nodeClusters[0];
    // Move first cluster to 0,0
    cluster.offset(-cluster.rect.left, -cluster.rect.top);

    for (let i = 1; i < nodeClusters.length; i++) {
      const nextCluster = nodeClusters[i];
      const xDiff = nextCluster.rect.left - cluster.rect.right - CLUSTER_PADDING;
      const yDiff = nextCluster.rect.top - cluster.rect.top;
      nextCluster.offset(-xDiff, -yDiff);
      cluster = nextCluster;
    }
  }

  combineSingleNodeCluster(nodeClusters: NodeCluster[]) {
    let firstSingleNodeCluster: NodeCluster | null = null;

    nodeClusters.forEach((cluster) => {
      if (cluster.size() === 1) {
        if (firstSingleNodeCluster === null) {
          firstSingleNodeCluster = cluster;
        } else {
          firstSingleNodeCluster.concat(cluster);
        }
      }
    });

    nodeClusters.forEach((cluster) => {
      if (cluster.size() === 1) {
        nodeClusters.splice(nodeClusters.indexOf(cluster), 1);
      }
    });
  }

  followEdges(graph: Graph, cluster: NodeCluster, node: Node, nodesVisited: Node[]) {
    graph.successorsOf(node).forEach((successor) => {
      if (!nodesVisited.includes(successor)) {
        nodesVisited.push(successor);
        cluster.add(successor);

        this.followEdges(graph, cluster, successor, nodesVisited);
      }
    });

    graph.predecessorsOf(node).forEach((predecessor) => {
      if (!nodesVisited.includes(predecessor)) {
        nodesVisited.push(predecessor);
        cluster.add(predecessor);

        this.followEdges(graph, cluster, predecessor, nodesVisited);
      }
    });
  }

  findClusterOf(clusters: NodeCluster[], node: Node): NodeCluster | null {
    for (const cluster of clusters) {
      if (cluster.contains(node)) {
        return cluster;
      }
    }

    return null;
  }

  findBiggestSize(graph: Graph): number {
    return graph.nodes.map(it => Math.max(it.height, it.width)).reduce((a, b) => Math.max(a, b), 0);
  }

  getOffset(graph: Graph): Offset {
    let offsetX = Infinity;
    let offsetY = Infinity;

    graph.nodes.forEach((node) => {
      offsetX = Math.min(offsetX, node.position.x);
      offsetY = Math.min(offsetY, node.position.y);
    });

    return new Offset(offsetX, offsetY);
  }

  done(): boolean {
    return this.tick < 1 / Math.max(this.graphWidth, this.graphHeight);
  }

  calculateGraphSize(graph: Graph): Size {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    graph.nodes.forEach((node) => {
      left = Math.min(left, node.position.x);
      top = Math.min(top, node.position.y);
      right = Math.max(right, node.position.x + node.width);
      bottom = Math.max(bottom, node.position.y + node.height);
    });

    return { width: right - left, height: bottom - top };
  }

  setFocusedNode(node: Node) { }

  setDimensions(width: number, height: number) {
    this.graphWidth = width;
    this.graphHeight = height;
  }
}

class NodeCluster {
  nodes: Node[] = [];
  rect: Rect = Rect.zero;

  getNodes(): Node[] {
    return this.nodes;
  }

  getRect(): Rect {
    return this.rect;
  }

  setRect(rect: Rect) {
    this.rect = rect;
  }

  add(node: Node) {
    this.nodes.push(node);

    if (this.nodes.length === 1) {
      this.rect = Rect.fromLTRB(node.x, node.y, node.x + node.width, node.y + node.height);
    } else {
      this.rect = Rect.fromLTRB(
        Math.min(this.rect.left, node.x),
        Math.min(this.rect.top, node.y),
        Math.max(this.rect.right, node.x + node.width),
        Math.max(this.rect.bottom, node.y + node.height)
      );
    }
  }

  contains(node: Node): boolean {
    return this.nodes.indexOf(node) !== -1;
  }

  size(): number {
    return this.nodes.length;
  }

  concat(cluster: NodeCluster) {
    cluster.nodes.forEach((node) => {
      node.position = new Offset(this.rect.right + CLUSTER_PADDING, this.rect.top);
      this.add(node);
    });
  }

  offset(xDiff: number, yDiff: number) {
    this.nodes.forEach((node) => {
      node.position = node.position.add(new Offset(xDiff, yDiff));
    });

    this.rect = this.rect.translate(xDiff, yDiff);
  }
}

// -- Figma Code --
figma.showUI(__html__, { width: 300, height: 380 });

const algorithm = new ForceDirectedGraph();

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
  if (msg.type === 'update-properties') {
    algorithm.setProperties(msg.data);
  }
  if (msg.type === 'create-graph') {
    const graph = Graph.fromJson(msg.data);
    const nodeMap = new Map<Node, ShapeWithTextNode>();

    for (let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i];

      const shape = figma.createShapeWithText();
      shape.x = node.position.x;
      shape.y = node.position.y;

      if (node.width > 0 && node.height > 0) {
        shape.resize(node.width, node.height);
      }

      await setText(shape.text, node.name ?? node.id);
      // shape.text.fontSize = 16;

      shape.fills = [{ type: "SOLID", color: { r: 1, g: 0.5, b: 0 } }];
      figma.currentPage.appendChild(shape);
      nodeMap.set(node, shape);
    }

    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i];

      const connector = figma.createConnector();
      connector.strokeWeight = 4;

      if (edge.name) {
        await setText(connector.text, edge.name);
        connector.text.fontSize = 50;
      }

      connector.connectorStart = {
        endpointNodeId: nodeMap.get(edge.source)!.id,
        magnet: "AUTO",
      };

      connector.connectorEnd = {
        endpointNodeId: nodeMap.get(edge.destination)!.id,
        magnet: "AUTO",
      };
    }

    const results = Array.from(nodeMap.values());
    figma.currentPage.selection = results;

    // Animate the graph
    algorithm.layout(graph);
    algorithm.init(graph);

    const tickMs = 25;
    let tick = 0;
    setInterval(() => {
      algorithm.step(graph);
      graph.nodes.forEach((node) => {
        const shape = nodeMap.get(node)!;
        shape.x = node.position.x;
        shape.y = node.position.y;
      });
      if (tick === 0) {
        figma.viewport.scrollAndZoomIntoView(results);
      }
      tick++;
    }, tickMs);
  }
};

async function setText(node: TextNode | TextSublayerNode, text: string) {
  const font = node.fontName as FontName;
  if ('family' in font && 'style' in font) {
    await figma.loadFontAsync(font);
  } else {
    // Fall back to default font
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  }
  try {
    node.characters = text;
  } catch (error) {
    console.log('Error setting text', error);
  }
}