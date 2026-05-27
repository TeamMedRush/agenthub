import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const jsObjectFileTemplate = `// AUTO GENERATED FILE - DO NOT EDIT

const classNames = {
[[CLASS_NAMES]]
};

export function useClasses(...args) {
  const validClasses = args.filter(arg => !!(arg && classNames[arg]));
  return validClasses.map(arg => classNames[arg]).join(' ');
}

`;

const tsObjectFileTemplate = `// AUTO GENERATED FILE - DO NOT EDIT

const classNames = {
[[CLASS_NAMES]]
} as const;

export type ClassName = (keyof typeof classNames);
export type PossibleClassName = ClassName | false | null | undefined;

export function useClasses(...args: PossibleClassName[]): string {
  const validClass = (arg: PossibleClassName) => !!(arg && arg in classNames);
  const validClasses = args.filter(validClass) as ClassName[];
  return validClasses.map(arg => classNames[arg]).join(' ');
}

`;

function extractClassNames(cssContent) {
  const contentWithoutComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const contentWithoutStrings = contentWithoutComments.replace(/"[^"]*"|'[^']*'/g, '');
  const contentWithoutUrls = contentWithoutStrings.replace(/url\((.*?)\)/g, '');
  
  const classNameRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
  const classNames = new Set();
  let match;

  while ((match = classNameRegex.exec(contentWithoutUrls)) !== null) {
    classNames.add(match[1]);
  }

  return Array.from(classNames);
}

async function resolveClassNames(src) {  
  const classNames = [];
  const files = await readdir(src);

  for (const file of files) {
    if (!file.endsWith('.css')) {
      const dirSrc = join(src, file);
      const dirRCN = await resolveClassNames(dirSrc);

      classNames.push(...dirRCN);  
      continue;
    }

    let file_content = await readFile(join(src, file), 'utf-8');
    const fileClassNames = extractClassNames(file_content);

    classNames.push(...fileClassNames);
  }

  return classNames;
}

async function buildObjectFile(resolvedClassNames, templateLang="js") {
  const templates = {
    js: jsObjectFileTemplate,
    ts: tsObjectFileTemplate
  };

  const fileContent = templates[templateLang].replace(
    '[[CLASS_NAMES]]',
    Array.from(new Set(resolvedClassNames)).map(
      name => `  '${name}': '${name}'`
    ).join(',\n')
  );

  return fileContent;
}

export async function buildStyles(cssDir, codeDir, templateLang="js") {
  const resolvedClassNames = await resolveClassNames(cssDir);
  const objectFile = await buildObjectFile(resolvedClassNames, templateLang);
  const filePath = join(codeDir, `styles.${templateLang}`);
  
  await writeFile(filePath, objectFile);
}

async function handleFileIndexedCreation(filepath) {
  try {
    await readFile(filepath);
    return;
  } catch (err) {
    if (err.code !== 'ENOENT')
      throw err;
  }

  await writeFile(filepath, '', 'utf-8');
}

async function createIndexedFiles(indexing, dirPath) {
  let indexCssContent = "";

  for (const name in indexing) {
    if (typeof indexing[name] === 'string') {
      indexCssContent += `@import './${indexing[name]}';\n`;
      const filePath = join(dirPath, indexing[name]);
      await handleFileIndexedCreation(filePath);
      continue;
    }

    indexCssContent += `@import './${name}/index.css';\n`;
    const subDirPath = join(dirPath, name);
    await mkdir(subDirPath, { recursive: true });
    await createIndexedFiles(indexing[name], subDirPath);
  }

  await writeFile(join(dirPath, 'index.css'), indexCssContent, 'utf-8');
}

export async function matchComponentsCssFiles(componentsDir, cssDir) {
  const components = await readdir(componentsDir, { recursive: true });
  const indexing = {};

  for (const component of components) {
    const validExtensions = ['.tsx', '.jsx'];
    if (!validExtensions.some(ext => component.endsWith(ext)))
      continue;

    const dir = component.split(/[/\\]/g);
    const name = dir.pop().split('.')[0];
    
    let indexRef = indexing;
    while (dir.length) {
      const parentDir = dir.shift();
      if (!indexRef[parentDir])
        indexRef[parentDir] = {};

      indexRef = indexRef[parentDir];
    }

    indexRef[name] = `${name}.css`;
  }

  await createIndexedFiles(indexing, cssDir);
}

