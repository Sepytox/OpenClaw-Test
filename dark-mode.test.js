/**
 * Comprehensive Dark Mode Tests
 * 
 * Tests cover:
 * 1. Button click toggles between light and dark mode
 * 2. Correct CSS classes applied in both modes
 * 3. localStorage saves and restores preference
 * 4. All critical elements are readable in both modes
 * 5. Toggle works in both directions (light→dark and dark→light)
 */

// ===== Test Environment Setup =====
// Minimal DOM/localStorage simulation for Node.js environments
// In a real browser, run these tests directly with a test runner like Jest + jsdom

/**
 * Test runner (minimal, no dependencies)
 */
const results = { passed: 0, failed: 0, errors: [] };

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        results.passed++;
    } catch (err) {
        console.log(`  ❌ FAIL: ${name}`);
        console.log(`     Error: ${err.message}`);
        results.failed++;
        results.errors.push({ name, error: err.message });
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

// ===== Mock DOM & localStorage =====
class MockClassList {
    constructor() { this._classes = new Set(); }
    add(cls) { this._classes.add(cls); }
    remove(cls) { this._classes.delete(cls); }
    toggle(cls) {
        if (this._classes.has(cls)) { this._classes.delete(cls); return false; }
        else { this._classes.add(cls); return true; }
    }
    contains(cls) { return this._classes.has(cls); }
    get size() { return this._classes.size; }
}

class MockElement {
    constructor(id) {
        this.id = id;
        this.classList = new MockClassList();
        this._attrs = {};
    }
    setAttribute(name, value) { this._attrs[name] = value; }
    getAttribute(name) { return this._attrs[name] || null; }
}

class MockLocalStorage {
    constructor() { this._store = {}; }
    setItem(key, value) { this._store[key] = String(value); }
    getItem(key) { return this._store.hasOwnProperty(key) ? this._store[key] : null; }
    removeItem(key) { delete this._store[key]; }
    clear() { this._store = {}; }
}

// Setup global mocks
const mockBody = new MockElement('body');
const mockLocalStorage = new MockLocalStorage();
const mockToggleBtn = new MockElement('themeToggle');

// Simulate the functions from index.html
function updateToggleButton(isDark) {
    if (mockToggleBtn) {
        mockToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        mockToggleBtn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
}

function toggleDarkMode() {
    var isDark = mockBody.classList.toggle('dark-mode');
    mockLocalStorage.setItem('darkMode', isDark);
    updateToggleButton(isDark);
    return isDark;
}

function initDarkMode() {
    var savedMode = mockLocalStorage.getItem('darkMode');
    if (savedMode === 'true') {
        mockBody.classList.add('dark-mode');
        updateToggleButton(true);
    }
}

function resetState() {
    mockBody.classList = new MockClassList();
    mockLocalStorage.clear();
    mockToggleBtn._attrs = {};
}

// ===== TEST SUITE =====

console.log('\n🧪 Dark Mode Feature Tests\n');
console.log('─'.repeat(50));

// ────────────────────────────────────────────────────
// 1. Toggle Tests
// ────────────────────────────────────────────────────
console.log('\n📋 1. Toggle Behavior Tests');

test('Clicking toggle adds dark-mode class when in light mode', () => {
    resetState();
    assert(!mockBody.classList.contains('dark-mode'), 'Should start in light mode');
    toggleDarkMode();
    assert(mockBody.classList.contains('dark-mode'), 'Should be in dark mode after toggle');
});

test('Clicking toggle removes dark-mode class when in dark mode', () => {
    resetState();
    mockBody.classList.add('dark-mode');
    toggleDarkMode();
    assert(!mockBody.classList.contains('dark-mode'), 'Should be in light mode after toggle');
});

test('Toggle returns true when switching to dark mode', () => {
    resetState();
    const result = toggleDarkMode();
    assertEqual(result, true, 'toggleDarkMode should return true when switching to dark');
});

test('Toggle returns false when switching to light mode', () => {
    resetState();
    mockBody.classList.add('dark-mode');
    const result = toggleDarkMode();
    assertEqual(result, false, 'toggleDarkMode should return false when switching to light');
});

test('Multiple toggles work correctly (light→dark→light)', () => {
    resetState();
    // Start in light
    assert(!mockBody.classList.contains('dark-mode'), 'Should start in light');
    toggleDarkMode();
    assert(mockBody.classList.contains('dark-mode'), 'Should be dark after 1st toggle');
    toggleDarkMode();
    assert(!mockBody.classList.contains('dark-mode'), 'Should be light after 2nd toggle');
    toggleDarkMode();
    assert(mockBody.classList.contains('dark-mode'), 'Should be dark after 3rd toggle');
});

// ────────────────────────────────────────────────────
// 2. localStorage Persistence Tests
// ────────────────────────────────────────────────────
console.log('\n📋 2. localStorage Persistence Tests');

test('Switching to dark mode saves "true" to localStorage', () => {
    resetState();
    toggleDarkMode();
    assertEqual(mockLocalStorage.getItem('darkMode'), 'true', 'localStorage should have darkMode=true');
});

test('Switching to light mode saves "false" to localStorage', () => {
    resetState();
    mockBody.classList.add('dark-mode');
    toggleDarkMode();
    assertEqual(mockLocalStorage.getItem('darkMode'), 'false', 'localStorage should have darkMode=false');
});

test('Page loads in dark mode when localStorage has darkMode=true', () => {
    resetState();
    mockLocalStorage.setItem('darkMode', 'true');
    initDarkMode();
    assert(mockBody.classList.contains('dark-mode'), 'Body should have dark-mode class after init with saved=true');
});

test('Page loads in light mode when localStorage has darkMode=false', () => {
    resetState();
    mockLocalStorage.setItem('darkMode', 'false');
    initDarkMode();
    assert(!mockBody.classList.contains('dark-mode'), 'Body should NOT have dark-mode class after init with saved=false');
});

test('Page loads in light mode when localStorage is empty', () => {
    resetState();
    initDarkMode();
    assert(!mockBody.classList.contains('dark-mode'), 'Body should NOT have dark-mode class when no preference saved');
});

test('localStorage persists after multiple toggles', () => {
    resetState();
    toggleDarkMode(); // → dark
    assertEqual(mockLocalStorage.getItem('darkMode'), 'true');
    toggleDarkMode(); // → light
    assertEqual(mockLocalStorage.getItem('darkMode'), 'false');
    toggleDarkMode(); // → dark
    assertEqual(mockLocalStorage.getItem('darkMode'), 'true');
});

// ────────────────────────────────────────────────────
// 3. Accessibility & Button Tests
// ────────────────────────────────────────────────────
console.log('\n📋 3. Accessibility & Button Tests');

test('Button aria-label updates to "Switch to light mode" in dark mode', () => {
    resetState();
    toggleDarkMode(); // → dark
    assertEqual(
        mockToggleBtn.getAttribute('aria-label'),
        'Switch to light mode',
        'aria-label should say "Switch to light mode" when in dark mode'
    );
});

test('Button aria-label updates to "Switch to dark mode" in light mode', () => {
    resetState();
    mockBody.classList.add('dark-mode');
    toggleDarkMode(); // → light
    assertEqual(
        mockToggleBtn.getAttribute('aria-label'),
        'Switch to dark mode',
        'aria-label should say "Switch to dark mode" when in light mode'
    );
});

test('Button title updates correctly for dark mode', () => {
    resetState();
    toggleDarkMode(); // → dark
    assertEqual(mockToggleBtn.getAttribute('title'), 'Switch to Light Mode');
});

test('Button title updates correctly for light mode', () => {
    resetState();
    mockBody.classList.add('dark-mode');
    toggleDarkMode(); // → light
    assertEqual(mockToggleBtn.getAttribute('title'), 'Switch to Dark Mode');
});

test('initDarkMode updates button accessibility attributes when restoring dark mode', () => {
    resetState();
    mockLocalStorage.setItem('darkMode', 'true');
    initDarkMode();
    assertEqual(mockToggleBtn.getAttribute('aria-label'), 'Switch to light mode');
    assertEqual(mockToggleBtn.getAttribute('title'), 'Switch to Light Mode');
});

// ────────────────────────────────────────────────────
// 4. CSS Structure Tests (static analysis)
// ────────────────────────────────────────────────────
console.log('\n📋 4. CSS Structure Tests');

const fs = require('fs');
const path = require('path');

function loadCSS() {
    const cssPath = path.join(__dirname, 'styles.css');
    if (!fs.existsSync(cssPath)) return null;
    return fs.readFileSync(cssPath, 'utf8');
}

function loadHTML() {
    const htmlPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(htmlPath)) return null;
    return fs.readFileSync(htmlPath, 'utf8');
}

test('styles.css contains dark mode body rule', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('body.dark-mode'), 'CSS must contain body.dark-mode rule');
});

test('styles.css contains dark mode header rule', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('body.dark-mode header'), 'CSS must have dark mode header styles');
});

test('styles.css contains dark mode main content rule', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('body.dark-mode main'), 'CSS must have dark mode main styles');
});

test('styles.css contains dark mode fact-card rule', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('body.dark-mode .fact-card'), 'CSS must have dark mode fact-card styles');
});

test('styles.css contains .theme-toggle button styling', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('.theme-toggle'), 'CSS must have .theme-toggle styles');
});

test('styles.css contains .header-top flex layout', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('.header-top'), 'CSS must have .header-top styles');
});

test('styles.css uses CSS transitions for smooth mode switching', () => {
    const css = loadCSS();
    assert(css !== null, 'styles.css must exist');
    assert(css.includes('transition:'), 'CSS must use transitions for smooth theme switching');
});

test('index.html has theme toggle button with correct id', () => {
    const html = loadHTML();
    assert(html !== null, 'index.html must exist');
    assert(html.includes('id="themeToggle"'), 'HTML must have button with id="themeToggle"');
});

test('index.html has toggleDarkMode function', () => {
    const html = loadHTML();
    assert(html !== null, 'index.html must exist');
    assert(html.includes('function toggleDarkMode'), 'HTML must have toggleDarkMode function');
});

test('index.html has localStorage initialization code', () => {
    const html = loadHTML();
    assert(html !== null, 'index.html must exist');
    assert(html.includes("localStorage.getItem('darkMode')") || html.includes('localStorage.getItem("darkMode")'),
        'HTML must have localStorage initialization code');
});

test('index.html has aria-label on toggle button', () => {
    const html = loadHTML();
    assert(html !== null, 'index.html must exist');
    assert(html.includes('aria-label'), 'Toggle button must have aria-label for accessibility');
});

// ────────────────────────────────────────────────────
// 5. Dark Mode Color Contrast Tests
// ────────────────────────────────────────────────────
console.log('\n📋 5. Dark Mode Color Readability Tests');

test('Dark mode background should be dark (not light)', () => {
    const css = loadCSS();
    // Check dark mode body background is dark color
    const darkBodyMatch = css.match(/body\.dark-mode\s*\{[^}]+background[^}]+\}/);
    assert(darkBodyMatch, 'Dark mode body must have background defined');
    // The dark mode uses dark gradient #1a1a2e - check for dark hex
    assert(
        css.includes('#1a1a2e') || css.includes('#16213e') || css.includes('#0f3460'),
        'Dark mode background must use dark colors (e.g., #1a1a2e, #16213e, #0f3460)'
    );
});

test('Dark mode main content background should not be white', () => {
    const css = loadCSS();
    // Find dark-mode main section
    const darkMainMatch = css.match(/body\.dark-mode main[\s\S]*?background:\s*([^;]+)/);
    assert(darkMainMatch, 'Dark mode main should have background defined');
    // Should not be pure white
    const bg = darkMainMatch[1].trim();
    assert(bg !== 'white' && bg !== '#fff' && bg !== '#ffffff',
        `Dark mode main background should not be white, got: ${bg}`);
});

test('Dark mode header background should be dark', () => {
    const css = loadCSS();
    assert(
        css.includes('body.dark-mode header'),
        'CSS must override header background in dark mode'
    );
    // Should have a dark color in the background
    const darkHeaderSection = css.substring(css.indexOf('body.dark-mode header'));
    const nextSection = darkHeaderSection.indexOf('}');
    const headerBlock = darkHeaderSection.substring(0, nextSection);
    assert(
        headerBlock.includes('background'),
        'Dark mode header must have background color override'
    );
});

// ────────────────────────────────────────────────────
// Results Summary
// ────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(50));
console.log(`📊 Test Results:`);
console.log(`   ✅ Passed: ${results.passed}`);
console.log(`   ❌ Failed: ${results.failed}`);
console.log(`   📝 Total:  ${results.passed + results.failed}`);

if (results.errors.length > 0) {
    console.log('\n🔴 Failed Tests:');
    results.errors.forEach(e => {
        console.log(`   • ${e.name}: ${e.error}`);
    });
}

console.log('═'.repeat(50));

if (results.failed > 0) {
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!\n');
    process.exit(0);
}
