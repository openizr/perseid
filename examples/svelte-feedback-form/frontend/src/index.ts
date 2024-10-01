import "./index.scss";
import Field from "./Field.svelte";
import Form from "@perseid/form/svelte";
import { type Configuration } from "@perseid/form";

const formConfiguration: Configuration = {
  // Root step-the form will start from there.
  root: "feedback",
  // Callback triggered on form submission.
  onSubmit(data) {
    alert(`Submitting the following JSON: ${JSON.stringify(data)}`);
    return Promise.resolve();
  },
  // `fields` define the data model the form is going to deal with.
  // Expect the submitted data JSON to match this schema.
  fields: {
    rating: {
      type: "integer",
      required: true,
    },
    review: {
      type: "string",
      required: true,
      // Display this field only if condition is met...
      condition: (inputs) =>
        inputs.rating !== null && (inputs.rating as number) < 3,
    },
    // Type `null` means that the value of this field will not be included in submitted data.
    submit: {
      type: "null",
      submit: true,
    },
    message_good: {
      type: "null",
    },
    message_bad: {
      type: "null",
    },
  },
  // Now that fields are defined, you can organize them in a single or multiple steps,
  // depending on the UI you want to build!
  steps: {
    feedback: {
      fields: ["rating", "review", "submit"],
      // Whether to submit the form at the end of this step.
      submit: true,
      // Next step is conditionned to previous user inputs...
      nextStep: (inputs) =>
        (inputs.rating as number) < 3 ? "thanks_bad" : "thanks_good",
    },
    thanks_good: {
      fields: ["message_good"],
    },
    thanks_bad: {
      fields: ["message_bad"],
    },
  },
};


// Let's run the app!
// Creating Svelte root...
const container = document.querySelector("#root") as unknown as HTMLElement;
container.innerHTML = '';
new Form({
  props: {
    Field: Field,
    configuration: formConfiguration,
  },
  target: container,
});
