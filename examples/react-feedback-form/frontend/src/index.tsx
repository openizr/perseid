import "./index.scss";
import React from "react";
import { type Configuration } from "@perseid/form";
import { createRoot, type Root } from "react-dom/client";
import Form, { type FormFieldProps } from "@perseid/form/react";

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

// The actual React component, used to build the UI!
function Field(props: FormFieldProps): JSX.Element {
  const { path, engine, value, status } = props;
  const [currentRating, setCurrentRating] = React.useState(0);

  // Display a different element depending on the field...

  if (path === "thanks_good.1.message_good") {
    return (
      <div className="message">
        <h1>Thanks for the feedback 🥳</h1>
        <p>We are glad you enjoyed!</p>
      </div>
    );
  }

  if (path === "thanks_bad.1.message_bad") {
    return (
      <div className="message">
        <h1>We're sorry to hear that 🥺</h1>
        <p>We'll do better next time, promise!</p>
      </div>
    );
  }

  if (path === "feedback.0.rating") {
    return (
      // Depending on the field status, define some extra classes for styling...
      <div
        className={`rating ${status === "error" ? "rating--error" : ""}`}
        onMouseLeave={() => {
          setCurrentRating((value as number | null) ?? 0);
        }}
      >
        <h1>How would you rate our service?</h1>
        {[1, 2, 3, 4, 5].map((rating) => (
          <span
            key={rating}
            className={`rating__star ${currentRating >= rating ? "rating__star--active" : ""
              }`}
            onMouseEnter={() => {
              setCurrentRating(rating);
            }}
            onClick={() => {
              // On click, notify the form engine about new user input.
              engine.userAction({ type: "input", path, data: rating });
            }}
          ></span>
        ))}
      </div>
    );
  }

  if (path === "feedback.0.review") {
    return (
      <div className={`review ${status === "error" ? "review--error" : ""}`}>
        <label>Could you tell us more?</label>
        <textarea
          onChange={(e) =>
            engine.userAction({ type: "input", path, data: e.target.value })
          }
        />
      </div>
    );
  }

  // path === 'feedback.0.submit'
  return (
    <button
      className="submit"
      onClick={() => {
        engine.userAction({ type: "input", path, data: true });
      }}
    >
      Submit
    </button>
  );
}

// Let's run the app!
let app: Root;

// Creating React root...
const container = document.querySelector("#root") as unknown as HTMLElement;
app = createRoot(container);
app.render(<Form Field={Field} configuration={formConfiguration} />);
