# Project Instructions

## General

- Read the relevant project documentation before making architectural decisions.
- Keep changes focused and incremental.
- Do not implement features that are not part of the current task.
- Avoid unnecessary abstractions and dependencies.
- Before introducing a new dependency, verify that the existing stack cannot reasonably solve the problem.
- Prefer simple solutions that can evolve when requirements justify it.
- Do not introduce technology solely for portfolio value.
- Do not silently change product requirements. If requirements are ambiguous or contradictory, surface the issue before making a product-level decision.
- Prefer redoing work over patching it. A rewrite is not a cost, and "to avoid losing what is already done" is not an argument.

## Memory

- Read `MEMORY.md` before starting: it holds the current state, the work in progress and the decisions already taken.
- Always update it when finishing a task: current state, important decisions with their why, and mistakes to avoid.
- Record only what the repo does not already say. If it is in `README.md`, `docs/PRODUCT_SPEC.md` or a code comment, do not repeat it in memory.
- Keep it under ~50 lines: summarize or delete what no longer earns its place.
- If something becomes a permanent rule, propose moving it to this document instead of leaving it in memory.
- `README.md` is the public-facing status; `MEMORY.md` is the working one. Do not let the two state the same thing.
- Never store secrets, tokens or personal data.

## Product

- Read `docs/PRODUCT_SPEC.md` before implementing product behavior.
- The product is location-agnostic. Do not hardcode the initial geographic scope into domain concepts, UI copy, or reusable components.
- Map-first does not mean map-only. Event discovery and access must remain possible without relying exclusively on map interaction.
- Product decisions should follow `docs/PRODUCT_SPEC.md`; engineering decisions should follow this document.

## Architecture

- Use TypeScript strictly.
- Keep external API/provider models separate from internal domain models.
- The UI and domain layer must not depend directly on provider-specific APIs or data structures.
- Keep provider-specific logic isolated behind small, explicit interfaces.
- Server state should be managed with TanStack Query.
- Use local React state for local UI state unless there is a demonstrated need for shared state.
- Do not introduce Redux without an explicit architectural justification.
- Prefer feature-oriented organization.
- Keep abstractions proportional to the current complexity of the application.
- Avoid premature generalization for hypothetical future requirements.

## State and URL

- Use the URL as the source of truth for shareable navigation, search, filter, and sorting state.
- Do not duplicate URL state in separate application state unless there is a clear reason.
- Keep ephemeral UI state local to the component or feature that owns it.

## Testing

- Test business-critical behavior.
- Prefer unit tests for pure functions and normalization logic.
- Use integration/component tests for important user interactions.
- Do not optimize for arbitrary code coverage targets.
- Every meaningful feature should include appropriate tests before it is considered complete.

## Accessibility

- Use semantic HTML.
- Interactive functionality must be keyboard accessible.
- Provide visible and programmatic states for interactive controls.
- Do not make the map the only way to discover or access an event.
- Provide accessible alternatives to map-only interactions.
- Do not rely on color alone to communicate meaning or state.

## Performance

- Avoid unnecessary renders and network requests.
- Use caching where appropriate.
- Lazy-load images where useful.
- Keep user interactions responsive.
- Do not introduce virtualization or other complex optimizations without evidence that they are needed.

## Responsive and Styling

- Build the UI mobile-first and progressively enhance it for tablet and desktop.
- Treat mobile as a first-class experience, not a reduced desktop layout.
- The map remains the primary discovery surface across screen sizes, while the list remains a first-class alternative.
- Use Tailwind CSS for styling and prefer its utility classes over custom CSS.
- Import Phosphor icons by their `Icon`-suffixed names (`ArrowDownIcon`); the bare names are deprecated.
- Keep component styling close to the component when practical.
- Avoid introducing a separate design system or styling abstraction unless the project actually needs it.
- Prefer semantic HTML and accessible interactive states over purely visual solutions.
- Keep responsive behavior intentional: define how layout, navigation, filters, event cards, and map/list interactions change across breakpoints.

## Workflow

Before implementing a non-trivial feature:

1. Inspect the existing implementation.
2. Read the relevant product and engineering documentation.
3. Identify relevant constraints and existing patterns.
4. Explain the proposed approach when architectural trade-offs exist.
5. Implement the smallest appropriate change.
6. Validate the changes according to the Validation section.
7. Review the resulting diff for unnecessary complexity or unrelated changes.
8. Update `MEMORY.md` to match the new state.

## Validation

After making code changes:

- Run the relevant tests.
- Run linting.
- Run type checking.
- Run the production build when appropriate.
- Report the validation commands run and their results.
- Do not consider the task complete while a relevant validation step is failing.

## Commits

- One short subject line, no body. The repository's history is one-liners.
