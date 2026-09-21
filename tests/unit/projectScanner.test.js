const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
	getProjectStructure,
	readProjectFile,
	resolveSafePath,
	searchProject,
} = require("../../backend/src/utils/projectScanner");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

test("resolveSafePath prevents directory traversal attacks with status 400", () => {
	const maliciousPaths = [
		"../../etc/passwd",
		"../../../etc/shadow",
		"../../../../Windows/System32/cmd.exe",
		"../outside_secret.txt",
		"/etc/passwd",
		"../../backend/.env",
	];

	for (const badPath of maliciousPaths) {
		assert.throws(
			() => resolveSafePath(PROJECT_ROOT, badPath),
			(err) => {
				assert.equal(
					err.message,
					"Path traversal is not allowed.",
					`Should reject traversal for path: ${badPath}`,
				);
				assert.equal(err.statusCode, 400);
				return true;
			},
		);
	}
});

test("resolveSafePath resolves valid within-root paths safely", () => {
	const resolvedPackage = resolveSafePath(PROJECT_ROOT, "package.json");
	assert.equal(resolvedPackage, path.join(PROJECT_ROOT, "package.json"));

	const resolvedApp = resolveSafePath(PROJECT_ROOT, "backend/src/app.js");
	assert.equal(resolvedApp, path.join(PROJECT_ROOT, "backend/src/app.js"));

	const resolvedRoot = resolveSafePath(PROJECT_ROOT, "");
	assert.equal(resolvedRoot, PROJECT_ROOT);
});

test("readProjectFile reads valid files and rejects invalid paths", async () => {
	// Valid file read
	const file = await readProjectFile(PROJECT_ROOT, "package.json");
	assert.ok(file.path.endsWith("package.json"));
	assert.ok(file.content.includes("lavoro"));
	assert.ok(typeof file.size === "number");

	// Rejects directory path
	await assert.rejects(
		() => readProjectFile(PROJECT_ROOT, "backend/src"),
		(err) => {
			assert.equal(err.message, "Requested path is not a file.");
			assert.equal(err.statusCode, 400);
			return true;
		},
	);

	// Rejects directory traversal
	await assert.rejects(
		() => readProjectFile(PROJECT_ROOT, "../../etc/passwd"),
		(err) => {
			assert.equal(err.message, "Path traversal is not allowed.");
			assert.equal(err.statusCode, 400);
			return true;
		},
	);
});

test("getProjectStructure traverses workspace while skipping ignored directories", async () => {
	const structure = await getProjectStructure(PROJECT_ROOT);

	assert.ok(Array.isArray(structure.files));
	assert.ok(structure.files.length > 0);
	assert.ok(structure.summary);

	// Confirm excluded directories are not crawled
	for (const file of structure.files) {
		assert.ok(!file.startsWith(".git/"), ".git files must not be tracked");
		assert.ok(!file.startsWith("node_modules/"), "root node_modules must not be tracked");
		assert.ok(!file.startsWith("backend/node_modules/"), "backend node_modules must not be tracked");
		assert.ok(!file.endsWith(".DS_Store"), ".DS_Store must not be tracked");
	}

	assert.ok(structure.summary.totalFiles > 0);
	assert.ok(typeof structure.summary.backendFiles === "number");
	assert.ok(typeof structure.summary.frontendFiles === "number");
});

test("searchProject returns matching code lines and ignores empty queries", async () => {
	// Empty query returns empty array
	const emptyResult = await searchProject(PROJECT_ROOT, "");
	assert.deepEqual(emptyResult, []);

	// Search for known keyword
	const results = await searchProject(PROJECT_ROOT, "express");
	assert.ok(results.length > 0, "should find references to express");
	assert.ok(results[0].path, "result should contain path");
	assert.ok(results[0].line, "result should contain line number");
	assert.ok(results[0].preview, "result should contain snippet preview");
});
