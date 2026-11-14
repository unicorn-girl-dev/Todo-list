import { ItemKind, ItemPriority, ItemStatus } from '../types/course';

export interface StarterModuleTemplate {
  key: string;
  code: string;
  title: string;
  instructor: string;
  orderIndex: number;
}

export interface StarterTaskTemplate {
  moduleKey: string;
  title: string;
  kind: ItemKind;
  status: ItemStatus;
  priority: ItemPriority;
  offsetHoursFromNow: number;
  reminderOffsetBeforeDueHours: number | null;
  estimatedMinutes: number;
  notes: string;
}

export const STARTER_MODULES: StarterModuleTemplate[] = [
  {
    key: 'm1',
    code: 'AI-101',
    title: 'Foundations of Machine Learning & Linear Algebra',
    instructor: 'Dr. Elena Rostova · Mon/Wed',
    orderIndex: 1,
  },
  {
    key: 'm2',
    code: 'AI-201',
    title: 'Deep Neural Networks & Backpropagation',
    instructor: 'Prof. Marcus Chen · Tue/Thu',
    orderIndex: 2,
  },
  {
    key: 'm3',
    code: 'AI-301',
    title: 'Transformers, Attention & Large Language Models',
    instructor: 'Dr. Priya Nair · Weekly Lab',
    orderIndex: 3,
  },
  {
    key: 'm4',
    code: 'AI-401',
    title: 'RAG Architectures, Embeddings & Vector Search',
    instructor: 'Sarah Jenkins · Workshop',
    orderIndex: 4,
  },
  {
    key: 'm5',
    code: 'AI-501',
    title: 'AI Agents, Tool Calling & Evaluation',
    instructor: 'Capstone Track · Friday Seminar',
    orderIndex: 5,
  },
];

export const STARTER_TASKS: StarterTaskTemplate[] = [
  {
    moduleKey: 'm1',
    title: 'Lecture 1: Gradient Descent & Convex Optimization',
    kind: 'class',
    status: 'completed',
    priority: 'medium',
    offsetHoursFromNow: -96,
    reminderOffsetBeforeDueHours: null,
    estimatedMinutes: 75,
    notes: 'Reviewed lecture slides and matrix calculus cheat sheet.',
  },
  {
    moduleKey: 'm1',
    title: 'Assignment 1: Implement Linear & Logistic Regression in NumPy',
    kind: 'assignment',
    status: 'completed',
    priority: 'high',
    offsetHoursFromNow: -48,
    reminderOffsetBeforeDueHours: null,
    estimatedMinutes: 150,
    notes: 'Submitted notebook with L2 regularization tests passing.',
  },
  {
    moduleKey: 'm2',
    title: 'Lecture 2: Activation Functions, BatchNorm & Residual Connections',
    kind: 'class',
    status: 'completed',
    priority: 'medium',
    offsetHoursFromNow: -24,
    reminderOffsetBeforeDueHours: null,
    estimatedMinutes: 90,
    notes: 'Watch recorded Q&A segment on vanishing gradients.',
  },
  {
    moduleKey: 'm2',
    title: 'Practice Lab: Build a 3-Layer MLP Autograd Engine',
    kind: 'task',
    status: 'in_progress',
    priority: 'high',
    offsetHoursFromNow: -4,
    reminderOffsetBeforeDueHours: 2,
    estimatedMinutes: 90,
    notes: 'Finish backward pass verification against PyTorch.',
  },
  {
    moduleKey: 'm2',
    title: 'Assignment 2: CIFAR-10 Image Classifier Tuning Report',
    kind: 'assignment',
    status: 'open',
    priority: 'high',
    offsetHoursFromNow: 18,
    reminderOffsetBeforeDueHours: 12,
    estimatedMinutes: 180,
    notes: 'Compare AdamW vs SGD with cosine annealing schedule.',
  },
  {
    moduleKey: 'm3',
    title: 'Live Seminar: Multi-Head Self-Attention & Positional Encodings',
    kind: 'class',
    status: 'open',
    priority: 'high',
    offsetHoursFromNow: 6,
    reminderOffsetBeforeDueHours: 1,
    estimatedMinutes: 90,
    notes: 'Read "Attention Is All You Need" Section 3 before class.',
  },
  {
    moduleKey: 'm3',
    title: 'Reading: RoPE & KV-Cache Memory Optimization Notes',
    kind: 'task',
    status: 'open',
    priority: 'medium',
    offsetHoursFromNow: 36,
    reminderOffsetBeforeDueHours: 4,
    estimatedMinutes: 45,
    notes: 'Summarize KV-cache memory formula in personal study doc.',
  },
  {
    moduleKey: 'm3',
    title: 'Assignment 3: Train a Character-Level GPT Transformer',
    kind: 'assignment',
    status: 'open',
    priority: 'high',
    offsetHoursFromNow: 72,
    reminderOffsetBeforeDueHours: 24,
    estimatedMinutes: 240,
    notes: 'Include causal mask unit tests and loss curve plot.',
  },
  {
    moduleKey: 'm4',
    title: 'Workshop: Hybrid Dense + BM25 Retrieval Pipeline',
    kind: 'class',
    status: 'open',
    priority: 'medium',
    offsetHoursFromNow: 110,
    reminderOffsetBeforeDueHours: 2,
    estimatedMinutes: 60,
    notes: 'Prepare local environment and sample PDF corpus.',
  },
  {
    moduleKey: 'm4',
    title: 'Task: Benchmark Chunking Strategies (256 vs 512 Tokens)',
    kind: 'task',
    status: 'open',
    priority: 'low',
    offsetHoursFromNow: 140,
    reminderOffsetBeforeDueHours: 12,
    estimatedMinutes: 60,
    notes: 'Measure recall@5 on 20 evaluation queries.',
  },
  {
    moduleKey: 'm5',
    title: 'Capstone Prep: Define Agent Evaluation Rubric & Tool Spec',
    kind: 'assignment',
    status: 'open',
    priority: 'medium',
    offsetHoursFromNow: 192,
    reminderOffsetBeforeDueHours: 24,
    estimatedMinutes: 120,
    notes: 'Submit 1-page proposal with latency and accuracy targets.',
  },
];
