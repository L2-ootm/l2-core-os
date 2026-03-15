---
name: frontend-architecture
description: "Use this skill when building frontend applications - structuring React/Vue components, managing state, handling API calls, implementing forms, or designing responsive layouts."
---

# Frontend Architecture Patterns

## When to use this skill
- When building new React/Vue components
- When designing state management
- When implementing forms or data fetching
- When building responsive layouts

## Component Patterns

### Component Structure
```tsx
// 1. Imports
import { useState, useEffect } from 'react';

// 2. Types (if TypeScript)
type Props = {
  title: string;
  onSubmit: (data: Data) => void;
};

// 3. Component
export function MyComponent({ title, onSubmit }: Props) {
  // 4. State
  const [loading, setLoading] = useState(false);
  
  // 5. Effects
  useEffect(() => {
    // fetch data
  }, []);

  // 6. Handlers
  const handleClick = () => {};

  // 7. Render
  return <div>{title}</div>;
}
```

### Component Patterns
- **Presentational**: UI only, no business logic
- **Container**: Business logic, data fetching
- **Compound**: Multiple related components

## State Management

### Local State
```tsx
const [value, setValue] = useState(initial);
const [loading, setLoading] = useState(false);
```

### Global State
- Use context for simple global state
- Use Zustand/Redux for complex state
- Never duplicate state

### Server State
- Use React Query or SWR for API data
- Handle loading, error, success states
- Implement optimistic updates when possible

## API Calls

### Fetch Pattern
```tsx
async function fetchData() {
  setLoading(true);
  try {
    const data = await apiGet('/endpoint');
    setData(data);
  } catch (e) {
    setError(e);
  } finally {
    setLoading(false);
  }
}
```

### Mutation Pattern
```tsx
async function submitData() {
  setLoading(true);
  try {
    await apiPost('/endpoint', payload);
    toast.success('Success!');
  } catch (e) {
    toast.error('Failed');
  } finally {
    setLoading(false);
  }
}
```

## Forms

### Controlled Inputs
```tsx
const [value, setValue] = useState('');
<input 
  value={value} 
  onChange={(e) => setValue(e.target.value)} 
/>
```

### Form Validation
- Validate on blur
- Validate on inline submit
- Show errors
- Disable submit during validation

## Responsive Design

### Breakpoints
```css
/* Mobile first */
.container { width: 100%; }

@media (min-width: 768px) {
  .container { width: 750px; }
}

@media (min-width: 1024px) {
  .container { width: 960px; }
}
```

### Mobile-First Tips
- Design for mobile first, expand for desktop
- Use relative units (rem, %, vh/vw)
- Touch targets: min 44px
- Test on real devices

## Error Handling

### Try-Catch Pattern
```tsx
try {
  await riskyOperation();
} catch (e) {
  // Show error to user
  // Log error for debugging
} finally {
  // Cleanup
}
```

### Error States
- Show user-friendly messages
- Provide retry options
- Log details for debugging

## Performance

### Optimization Tips
1. Use `useMemo` for expensive calculations
2. Use `useCallback` for function props
3. Lazy load components with `React.lazy`
4. Optimize images (WebP, lazy loading)
5. Virtualize long lists

## CSS Patterns

### BEM Naming
```css
.block {}
.block__element {}
.block--modifier {}
```

### Utility Classes
- Use Tailwind or similar
- Compose patterns
- Keep consistent spacing
```
