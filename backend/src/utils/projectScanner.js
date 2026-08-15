const fs = require("fs/promises");
const path = require("path");

const SKIP_DIRS = new Set([
	".git",
	"node_modules",
	"dist",
	"build",
	"coverage",
	".next",
	".cache",
	"__pycache__",
]);

const SKIP_FILES = new Set([".env", ".DS_Store"]);
const MAX_FILES = 160;
const MAX_FILE_BYTES = 80_000;

async function getProjectStructure(rootDir) {
	const files = [];
	await walk(rootDir, rootDir, files);

	return {
		root: rootDir,
		files,
		summary: summarizeFiles(files),
	};
}

async function readProjectFile(rootDir, relativePath) {
	const safePath = resolveSafePath(rootDir, relativePath);
	const stat = await fs.stat(safePath);

	if (!stat.isFile()) {
		const error = new Error("Requested path is not a file.");
		error.statusCode = 400;
		throw error;
	}

	if (stat.size > MAX_FILE_BYTES) {
		const error = new Error("File is too large to read safely.");
		error.statusCode = 413;
		throw error;
	}

	return {
		path: normalizeRelative(rootDir, safePath),
		content: await fs.readFile(safePath, "utf8"),
		size: stat.size,
	};
}

async function searchProject(rootDir, query) {
	const needle = String(query || "").trim().toLowerCase();
	if (!needle) return [];

	const structure = await getProjectStructure(rootDir);
	const results = [];

	for (const filePath of structure.files) {
		if (results.length >= 20) break;
		if (!isTextFile(filePath)) continue;

		try {
			const file = await readProjectFile(rootDir, filePath);
			const lines = file.content.split("\n");
			lines.forEach((line, index) => {
				if (results.length >= 20) return;
				if (line.toLowerCase().includes(needle)) {
					results.push({
						path: file.path,
						line: index + 1,
						preview: line.trim().slice(0, 180),
					});
				}
			});
		} catch {
			// Ignore unreadable files; project search should be best-effort.
		}
	}

	return results;
}

async function walk(rootDir, currentDir, files) {
	if (files.length >= MAX_FILES) return;

	const entries = await fs.readdir(currentDir, { withFileTypes: true });
	for (const entry of entries) {
		if (files.length >= MAX_FILES) return;
		if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
		if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
		if (entry.isFile() && SKIP_FILES.has(entry.name)) continue;

		const absolutePath = path.join(currentDir, entry.name);
		if (entry.isDirectory()) {
			await walk(rootDir, absolutePath, files);
		} else if (entry.isFile()) {
			files.push(normalizeRelative(rootDir, absolutePath));
		}
	}
}

function summarizeFiles(files) {
	return {
		totalFiles: files.length,
		frontendFiles: files.filter((file) => file.startsWith("frontend/")).length,
		backendFiles: files.filter((file) => file.startsWith("backend/")).length,
		testFiles: files.filter((file) => /(^|\/)(test|tests)\//.test(file)).length,
		packageFiles: files.filter((file) => file.endsWith("package.json")).length,
	};
}

function resolveSafePath(rootDir, relativePath) {
	const safePath = path.resolve(rootDir, relativePath || "");
	const normalizedRoot = path.resolve(rootDir);

	if (!safePath.startsWith(`${normalizedRoot}${path.sep}`) && safePath !== normalizedRoot) {
		const error = new Error("Path traversal is not allowed.");
		error.statusCode = 400;
		throw error;
	}

	return safePath;
}

function normalizeRelative(rootDir, absolutePath) {
	return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function isTextFile(filePath) {
	return /\.(js|ts|jsx|tsx|py|java|c|cpp|go|rs|sql|html|css|json|yml|yaml|md|sh|txt)$/i.test(
		filePath,
	);
}

module.exports = {
	getProjectStructure,
	readProjectFile,
	searchProject,
};
