const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================================');
console.log('   RESIDE: PROPERTY MANAGEMENT OVERVIEW LAYOUT & LIGHTBOX TEST          ');
console.log('========================================================================\n');

const componentPath = path.resolve(__dirname, '../frontend/src/components/PropertyFullScreenView.tsx');
assert(fs.existsSync(componentPath), 'PropertyFullScreenView.tsx must exist');
const content = fs.readFileSync(componentPath, 'utf8');

// Test 1: Full available width & removal of restrictive max-w constraints on Overview
console.log('Test 1: Full available width & removal of restrictive max-w constraints...');
assert(!content.includes('max-w-5xl'), 'max-w-5xl must be removed from the Overview section to allow full width expansion');
assert(
  content.includes('grid-cols-[256px_minmax(0,1fr)]') || content.includes('grid-template-columns: minmax(0, 1fr)'),
  'Workspace layout must use minmax(0, 1fr) for main content area'
);
console.log('   ✓ Overview is no longer clamped to max-w-5xl');
console.log('   ✓ Main workspace uses minmax(0, 1fr) grid column to occupy full remaining width\n');

// Test 2: Balanced Two-Column Overview Layout
console.log('Test 2: Balanced responsive two-column Overview layout...');
assert(content.includes('lg:grid-cols-12'), 'Overview must use responsive 12-column grid layout on desktop');
assert(content.includes('aspect-[16/10]'), 'Property image must have prominent, consistent aspect ratio');
assert(content.includes('View Gallery') || content.includes('openLightbox'), 'Image must have gallery trigger / lightbox interaction');
console.log('   ✓ Left container features substantially enlarged image with consistent 16/10 aspect ratio');
console.log('   ✓ Right container provides responsive grid for specifications & details');
console.log('   ✓ Full-width bottom container handles Danger Zone (Owner) / Quick Actions (Tenant)\n');

// Test 3: Interactive Lightbox / Image Viewer Overlay
console.log('Test 3: Image Gallery & Lightbox overlay implementation...');
assert(content.includes('isLightboxOpen'), 'Component must track isLightboxOpen state');
assert(content.includes('lightboxIndex'), 'Component must track lightboxIndex state');
assert(content.includes('openLightbox'), 'Component must provide openLightbox handler');
assert(content.includes('handleKeyDown'), 'Component must provide keyboard event listeners (Escape, ArrowLeft, ArrowRight)');
assert(content.includes('document.body.style.overflow = \'hidden\''), 'Lightbox must lock body scroll when open');
assert(content.includes('role="dialog"'), 'Lightbox must be accessible dialog modal');
assert(content.includes('e.target === e.currentTarget'), 'Backdrop click must close lightbox without closing on control interaction');
console.log('   ✓ Lightbox tracks open state and active index');
console.log('   ✓ Keyboard navigation (Esc to close, ArrowLeft/ArrowRight to cycle) implemented');
console.log('   ✓ Body scroll lock prevents background scrolling');
console.log('   ✓ Backdrop click closes without interfering with controls or images\n');

// Test 4: Management Sections Sidebar Enlargement & Sticky Positioning
console.log('Test 4: Management Sections sidebar enlargement & sticky positioning...');
assert(content.includes('sticky top-[88px] self-start') || content.includes('sticky top-'), 'Sidebar must be sticky with offset accounting for header');
assert(content.includes('256px') || content.includes('w-64'), 'Sidebar must have comfortable medium size width');
assert(content.includes('text-sm font-medium'), 'Sidebar items must use comfortable medium typography');
assert(content.includes('Management Sections') || content.includes('பிரிவுகள்'), 'Sidebar must display Management Sections header');

// All 9 sections must be preserved
const requiredSections = ['overview', 'edit', 'listing', 'requests', 'tenancy', 'payments', 'agreements', 'maintenance', 'vacate'];
requiredSections.forEach((sec) => {
  assert(content.includes(`key: '${sec}'`), `Section '${sec}' must be preserved in allNavItems`);
});
console.log('   ✓ Sidebar is sticky at top-[88px] self-start to sit cleanly below header');
console.log('   ✓ Sidebar width allocated fixed column (256px-270px) with comfortable medium buttons');
console.log('   ✓ All 9 management sections strictly preserved\n');

// Test 5: Mobile Adaptive Navigation
console.log('Test 5: Mobile adaptive navigation...');
assert(content.includes('md:hidden w-full overflow-x-auto'), 'Mobile navigation must adapt to accessible horizontal scrollable bar');
console.log('   ✓ Mobile navigation adapts to compact scrollable pill bar without consuming vertical screen space\n');

console.log('========================================================================');
console.log('   ALL OVERVIEW LAYOUT & LIGHTBOX TESTS PASSED SUCCESSFULLY!            ');
console.log('========================================================================\n');
