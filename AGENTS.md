# Project Instructions

## General

- Read the relevant project documentation before making architectural
  decisions.
- Keep changes focused and incremental.
- Do not implement features that are not part of the current task.
- Avoid unnecessary abstractions and dependencies.
- Prefer simple solutions that can evolve when requirements justify it.
- Do not introduce technology solely for portfolio value.

## Product

Read `docs/PRODUCT_SPEC.md` before implementing product behavior.

The product is location-agnostic. Do not hardcode the initial geographic
scope into domain concepts, UI copy, or reusable components.

## Architecture

- Use TypeScript strictly.
- Keep external API models separate from internal domain models.
- Server state should be managed with TanStack Query.
- Use local React state for local UI state unless there is a demonstrated
  need for shared state.
- Do not introduce Redux without an explicit architectural justification.
- Prefer feature-oriented organization.
- Keep provider-specific logic isolated from the UI and domain layer.

## Testing

- Test business-critical behavior.
- Prefer unit tests for pure functions and normalization logic.
- Use integration/component tests for important user interactions.
- Do not optimize for arbitrary code coverage targets.

## Accessibility

- Use semantic HTML.
- Interactive functionality must be keyboard accessible.
- Do not make the map the only way to discover or access an event.
- Provide accessible alternatives to map-only interactions.

## Performance

- Avoid unnecessary renders and network requests.
- Use caching where appropriate.
- Lazy-load images where useful.
- Do not introduce virtualization or other complex optimizations without
  evidence that they are needed.

## Workflow

Before implementing a non-trivial feature:

1. Inspect the existing implementation.
2. Identify relevant constraints.
3. Explain the proposed approach when architectural trade-offs exist.
4. Implement the smallest appropriate change.
5. Run relevant tests, linting, and type checks.

## Responsive and styling

- Build the UI mobile-first and progressively enhance it for tablet and desktop.
- Treat mobile as a first-class experience, not a reduced desktop layout.
- The map remains the primary discovery surface across screen sizes.
- Use Tailwind CSS for styling and prefer its utility classes over custom CSS.
- Keep component styling close to the component when practical.
- Avoid introducing a separate design system or styling abstraction unless the project actually needs it.
- Prefer semantic HTML and accessible interactive states over purely visual solutions.
- Keep responsive behavior intentional: define how layout, navigation, filters, event cards, and map/list interactions change across breakpoints.
