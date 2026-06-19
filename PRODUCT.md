# Product

## Register

product

## Users
Cashiers operating under fast-paced checkout queues at a cafe POS counter. Staff needs to quickly customize beverages/food, apply discounts, review cart totals, and print receipts. Secondary users include kitchen/barista staff who view order queues on display monitors.

## Product Purpose
A high-performance POS ordering and kitchen display system (KDS) that allows cafe operators to take orders, customize menu modifiers, track order statuses, and archive transactions instantaneously.

## Brand Personality
Clean, Minimalist, High-Contrast, Functional, Lightweight.

## Anti-references
* **Legacy Industrial Clutter**: Avoid dense, gray-heavy grid buttons that feel dated and confusing.
* **Heavy visual effects**: Avoid blur, drop-shadow cascades, glassmorphism, or complex page transitions that cause rendering lag on low-spec hardware.
* **Tiny action targets**: Avoid small checkbox rows or tiny text buttons that cause misclicks on touchscreen registers.

## Design Principles
1. **Performance Over Ornament**: Keep CSS rendering lightweight. No CPU-heavy animations, shadows, or backdrop blurs. Prioritize instant page responsiveness for low-spec POS machines.
2. **Scannable Hierarchy**: Use high-contrast font weights and clear border separators instead of nested card blocks or color floods.
3. **Ergonomic touch targets**: Ensure all interactive buttons have generous click target sizes suited for cashier touchscreens.

## Accessibility & Inclusion
* Touch target sizes of at least 44x44px for critical POS controls.
* High text contrast ratios (minimum 4.5:1) for bright, clear readability.
* Prefers-reduced-motion respected (no transition overhead).
