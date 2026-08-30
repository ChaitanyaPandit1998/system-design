import { createShapeId, type Editor } from "tldraw";
import { notesPanel, rect, seg, summaryPanel } from "./shapes";

// Page: Message Queues — RabbitMQ vs Kafka vs SQS
// (following docs/message-queues.md)
//
// Like druid-iceberg.ts, this doc isn't one system — it's a comparison of
// three. The diagram worth drawing is the difference between them: the same
// three-stage shape (producer -> core mechanism -> consumer) repeated in
// three columns, so the actual mechanical difference (push vs. pull,
// exchange+binding vs. partitioned log vs. visibility timeout) is what
// stands out, not three unrelated component lists.

export const VERSION = 1;

export const SOURCE_DOC = "docs/message-queues.md";
export const SOURCE_DOC_HASH = "105cf1682034";

export function build(editor: Editor) {
  const id = () => createShapeId();

  // column x-centers: RabbitMQ 360, Kafka 1160, SQS 1960
  const rmqProducer = id();
  const kafkaProducer = id();
  const sqsProducer = id();

  const rmqCore = id();
  const kafkaCore = id();
  const sqsCore = id();

  const rmqConsumer = id();
  const kafkaConsumer = id();
  const sqsConsumer = id();

  editor.createShapes([
    rect(rmqProducer, 200, 100, 320, 110, "Producer"),
    rect(kafkaProducer, 1000, 100, 320, 110, "Producer"),
    rect(sqsProducer, 1800, 100, 320, 110, "Producer"),

    rect(
      rmqCore,
      140,
      420,
      440,
      260,
      "RabbitMQ\n\nExchange (topic/direct/fanout)\n→ binding (routing key)\n→ Queue (ordered buffer)\n\npush delivery + consumer ACK",
      { verticalAlign: "start" }
    ),
    rect(
      kafkaCore,
      940,
      420,
      440,
      260,
      "Kafka\n\nTopic → Partitions (ordered log)\nspread across Brokers\n(leader + follower replicas)\n\nconsumers pull (poll) by offset",
      { verticalAlign: "start" }
    ),
    rect(
      sqsCore,
      1740,
      420,
      440,
      260,
      "Amazon SQS\n\nQueue (managed, 3 AZs)\nvisibility timeout hides a\nmessage while it's processed\n\nconsumer polls + deletes",
      { verticalAlign: "start" }
    ),

    rect(rmqConsumer, 200, 820, 320, 150, "Consumer(s)\n\nACK → deleted\nno ACK → redelivered"),
    rect(
      kafkaConsumer,
      1000,
      820,
      320,
      150,
      "Consumer Group\n\neach partition read by\nexactly one consumer\nin the group"
    ),
    rect(
      sqsConsumer,
      1800,
      820,
      320,
      150,
      "Consumer\n\nDeleteMessage → removed\nno delete → reappears\nafter timeout"
    ),
  ]);

  editor.createShapes([
    seg(id(), 360, 210, 360, 420, { text: "publish", arrowEnd: "arrow" }),
    seg(id(), 1160, 210, 1160, 420, { text: "produce\n(batched)", arrowEnd: "arrow" }),
    seg(id(), 1960, 210, 1960, 420, { text: "SendMessage", arrowEnd: "arrow" }),

    seg(id(), 360, 680, 360, 820, { text: "push + ack", arrowEnd: "arrow" }),
    seg(id(), 1160, 680, 1160, 820, { text: "poll (pull)", arrowEnd: "arrow" }),
    seg(id(), 1960, 680, 1960, 820, { text: "Receive /\nDelete", arrowEnd: "arrow" }),
  ]);

  const notesId = notesPanel(editor, "When to use which", [
    {
      heading: "RabbitMQ",
      items: [
        "Complex routing rules, low-latency task queues",
        "IoT/MQTT, on-prem microservice decoupling",
        "Avoid for: high-throughput streaming, message replay",
      ],
    },
    {
      heading: "Kafka",
      items: [
        "Real-time event streaming, audit logs, event sourcing",
        "High-throughput pipelines, stream processing, fan-out",
        "Avoid for: simple task queues (overkill), AWS-serverless-only stacks",
      ],
    },
    {
      heading: "Amazon SQS",
      items: [
        "AWS serverless / Lambda triggers, minimal-ops startups",
        "Simple decoupling on AWS (pair with SNS for fan-out)",
        "Avoid for: strict ordering at scale, replay, complex routing",
      ],
    },
  ]);

  summaryPanel(editor, notesId, "How it works — Message Queues", [
    "All three solve the same core problem — decouple a producer from a consumer — but make very different trade-offs in how messages are routed, stored, and acknowledged.",
    "RabbitMQ pushes messages: a producer publishes to an exchange, which routes it to one or more queues via bindings, and the broker pushes each message to a subscribed consumer, redelivering it if the consumer doesn't ACK.",
    "Kafka is a distributed, replicated log: producers append records to partitions spread across brokers, and independent consumer groups pull (poll) from wherever they left off by offset — which is what makes replay and multiple independent readers of the same stream possible.",
    "SQS is a fully managed queue with no broker to run: a consumer polls for messages, and a visibility timeout hides a message from other consumers while it's being processed instead of using a persistent connection — the message reappears automatically if it's never deleted.",
  ]);

  editor.zoomToFit();
}
