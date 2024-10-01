<!-- The actual React component, used to build the UI! -->
<script lang="ts" context="module">
import type { FormFieldProps } from "@perseid/form/svelte";
</script>

<script lang="ts">
export let path: FormFieldProps['path'];
export let type: FormFieldProps['type'];
export let value: FormFieldProps['value'];
export let Field: FormFieldProps['Field'];
export let error: FormFieldProps['error'];
export let status: FormFieldProps['status'];
export let engine: FormFieldProps['engine'];
export let fields: FormFieldProps['fields'];
export let isActive: FormFieldProps['isActive'];
export let activeStep: FormFieldProps['activeStep'];
export let isRequired: FormFieldProps['isRequired'];
export let setActiveStep: FormFieldProps['setActiveStep'];
export let useSubscription: FormFieldProps['useSubscription'];

let currentRating = 0;
$: currentValue = value as number;
$: fields, isActive, activeStep, setActiveStep, useSubscription, type, error, Field, isRequired;

const setCurrentRating = (newRating: number) => {
  currentRating = newRating;
};

const handleReviewChange = (event: Event) => {
  engine.userAction({ type: "input", path, data: (event.target as HTMLTextAreaElement).value })
};
</script>

 <!-- Display a different element depending on the field... -->

{#if path === 'thanks_good.1.message_good'}
  <div class="message">
    <h1>Thanks for the feedback 🥳</h1>
    <p>We are glad you enjoyed!</p>
  </div>
{:else if path === 'thanks_bad.1.message_bad'}
  <div class="message">
    <h1>We're sorry to hear that 🥺</h1>
    <p>We'll do better next time, promise!</p>
  </div>
{:else if path === 'feedback.0.review'}
  <div class={`review ${status === "error" ? "review--error" : ""}`}>
    <label for="#review">Could you tell us more?</label>
    <textarea
      id="review"
      on:change={handleReviewChange}
    />
  </div>
{:else if path === 'feedback.0.rating'}
  <!-- Depending on the field status, define some extra classes for styling... -->
  <div
    role="button"
    tabindex="0"
    class={`rating ${status === "error" ? "rating--error" : ""}`}
    on:mouseleave={() => {
      setCurrentRating(currentValue ?? 0);
    }}
  >
    <h1>How would you rate our service?</h1>
    {#each [1, 2, 3, 4, 5] as rating (rating)}
      <span
        role="button"
        tabindex="0"
        class={`rating__star ${currentRating >= rating ? "rating__star--active" : ""}`}
        on:mouseenter={() => {
          setCurrentRating(rating);
        }}
        on:keydown={() => {}}
        on:click={() => {
          // On click, notify the form engine about new user input.
          engine.userAction({ type: "input", path, data: rating });
        }}
    ></span>
    {/each}
  </div>
{:else}
  <!-- path === 'feedback.0.submit' -->
  <button
    class="submit"
    on:click={() => {
      engine.userAction({ type: "input", path, data: true });
    }}
  >
    Submit
  </button>
{/if}
