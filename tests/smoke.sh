#!/bin/bash
set -e

echo "Running smoke tests..."

# Build the project
echo "1. Building project..."
npm run build

# Check if dist/oa.js was created
if [ ! -f "dist/oa.js" ]; then
  echo "ERROR: dist/oa.js not found"
  exit 1
fi
echo "✓ Build successful"

# Test CLI help
echo "2. Testing CLI help..."
if node dist/oa.js --help | grep -q "OpenArmy"; then
  echo "✓ CLI help works"
else
  echo "ERROR: CLI help failed"
  exit 1
fi

# Test oa list on empty registry
echo "3. Testing oa list..."
if node dist/oa.js list | grep -q "No plugins"; then
  echo "✓ Empty list works"
else
  echo "ERROR: oa list failed"
  exit 1
fi

# Create test fixture
echo "4. Creating test fixture..."
cd tests/fixtures/oa-echo
npm pack
cd ../../..
echo "✓ Test fixture created"

# Test oa add
echo "5. Testing oa add..."
if node dist/oa.js add ./tests/fixtures/oa-echo/oa-echo-1.0.0.tgz; then
  echo "✓ oa add works"
else
  echo "ERROR: oa add failed"
  exit 1
fi

# Test oa list with plugin
echo "6. Testing oa list with plugin..."
if node dist/oa.js list | grep -q "oa-echo"; then
  echo "✓ Plugin listed"
else
  echo "ERROR: Plugin not listed"
  exit 1
fi

# Test oa run
echo "7. Testing oa run..."
if OUTPUT=$(node dist/oa.js run oa-echo --input="hello"); then
  if [ "$OUTPUT" = "hello" ]; then
    echo "✓ oa run works"
  else
    echo "ERROR: oa run output mismatch. Got: '$OUTPUT'"
    exit 1
  fi
else
  echo "ERROR: oa run failed"
  exit 1
fi

# Test oa remove
echo "8. Testing oa remove..."
if node dist/oa.js remove oa-echo; then
  echo "✓ oa remove works"
else
  echo "ERROR: oa remove failed"
  exit 1
fi

# Verify removed
echo "9. Verifying plugin was removed..."
if node dist/oa.js list | grep -q "No plugins"; then
  echo "✓ Plugin removed successfully"
else
  echo "ERROR: Plugin still listed"
  exit 1
fi

echo ""
echo "✓ All smoke tests passed!"
