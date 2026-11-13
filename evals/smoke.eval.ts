import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Records a skip decision with record_decision and stays supervised.",
  async test(t) {
    await t.send(
      'Marcos decided to skip job remotive:999 "Junior React Intern" at ExampleCo. Record that skip with notes "seniority too low". Do not apply anywhere.',
    );
    t.succeeded();
    t.calledTool("record_decision");
    t.notCalledTool("search_jobs");
    t.check(t.reply, includes(/skip|registr|guard/i));
  },
});
