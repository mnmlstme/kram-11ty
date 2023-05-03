const Kr = require("@cre.ative/kram");

module.exports = {
  name: "web-standard",
  displayName: "Web (W3C Standard)",
  description: "Standard technologies supported by nearly all browsers",
  languages: {
    html: "Hypertext Markup Language (HTML5)",
    css: "Cascading Style Sheets (CSS3)",
    js: "Javascript (ES6)",
    svg: "Scalable Vector Graphics",
  },
  register,
};

const svgDefnRegex = /^\s*<(defs|symbol)[^>]*>/i;
const htmlDefnRegex = /^\s*<(template)[^>]*>/i;
const jsDefnRegex = /^\s*(function|class|let|const|var)\s+(\w+)/;

function register({ providesLanguage, defaultModule }) {
  providesLanguage("html", {
    classify: (code) => {
      const defnMatch = code.match(htmlDefnRegex);
      return defnMatch
        ? {
            mode: "define",
            type: defnMatch[1],
          }
        : { mode: "eval" };
    },
    collate: (workbook) => {
      const { scenes, definitions } = Kr.extract(workbook, "html");
      const buildDefn = ([n, attrs, code]) => code;
      const buildScene = ([n, attrs, code]) =>
        `<kram-scene scene="${n + 1}">${code}</kram-scene>`;

      return [].concat(
        definitions.length
          ? [
              {
                name: "templates.html",
                mode: "define",
                language: "html",
                code: definitions.map(buildDefn).join("\n"),
              },
            ]
          : [],
        scenes.length
          ? [
              {
                name: "scenes.html",
                mode: "eval",
                language: "html",
                code: `
                ${scenes.map(buildScene).join("\n")}
                `,
              },
            ]
          : []
      );
    },
  });

  providesLanguage("css", {
    classify: () => ({
      mode: "define",
    }),
    collate: (workbook) => {
      const { definitions } = Kr.extract(workbook, "css");
      const buildDefn = ([n, attrs, code]) =>
        `/* Kram: CSS in Scene ${n + 1} */\n${code}`;

      return {
        name: "styles.css",
        mode: "define",
        language: "css",
        code: definitions.map(buildDefn).join("\n"),
      };
    },
  });

  providesLanguage("svg", {
    classify: (code) => {
      const defnMatch = code.match(svgDefnRegex);
      return defnMatch
        ? {
            mode: "define",
            type: defnMatch[1],
          }
        : { mode: "eval" };
    },
    collate: (workbook) => {
      const { scenes, definitions } = Kr.extract(workbook, "svg");
      const buildDefn = ([n, attrs, code]) => code;
      const buildScene = ([n, attrs, code]) => ({
        name: `scene-${n + 1}.svg`,
        language: "svg",
        mode: "eval",
        scene: n + 1,
        code: `<svg xmlns="http://www.w3.org/2000/svg">${code}</svg>`,
      });
      const sceneFiles = scenes.map(buildScene);

      return [
        {
          name: "defs.svg",
          mode: "define",
          language: "svg",
          code: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none;">
            <defs>${definitions.map(buildDefn).join("\n")}</defs></svg>`,
        },
        ...sceneFiles,
      ];
    },
  });

  providesLanguage("js", {
    classify: classifyJavascript,
    collate: (workbook) => {
      const { moduleName, imports } = workbook;
      const { scenes, definitions } = Kr.extract(workbook, "js");
      const buildDefn = ([n, attrs, code]) =>
        `// JS Definition from scene ${n + 1}\n${code}`;
      const buildScene = ([n, attrs, code]) =>
        `// JS scene ${n + 1}\n"${n}": function () { ${code} }`;

      return {
        moduleName,
        name: "module.js",
        language: "js",
        code: `// module ${moduleName} (ES6)
          ${imports.map(buildImport).join("\n")}
          console.log('Loading module "${moduleName}"')
          export function Program ({connectStore, initializeStore}) {
            ${definitions.map(buildDefn).join("\n")}
            return ({
              ${scenes.map(buildScene).join(",\n")}
            })
          }
          export function mount (mountpoint, initial) {
            let Store = {
              root: Object.assign({}, initial),
            };
            const connectStore = (path = ["root"]) => {
              let root = Store;
              path.forEach((key) => root = root[key]);
              return ({
                root,
                get: (key) => root[key],
                set: (key, value) => root[key] = value,
                keys: () => Object.keys(root),
              })};
            const program = Program({connectStore})
            return (n, container) => {
              program[n-1].call(container)
            }
          }

        `,
      };
    },
  });
}

function classifyJavascript(code) {
  const keywordToType = {
    function: "function",
    const: "constant",
    var: "variable",
    let: "variable",
  };
  const defnMatch = code.match(jsDefnRegex);

  return {
    mode: "define",
    definitions: defnMatch
      ? [
          {
            name: defnMatch[2],
            type: keywordToType[defnMatch[1]],
          },
        ]
      : undefined,
  };
}

function buildImport(spec) {
  if (spec.expose) {
    const list =
      spec.expose === "*" ? spec.expose : "{ " + spec.expose.join(", ") + " }";
    const maybeDefault = spec.as ? spec.as + ", " : "";

    return `import ${maybeDefault}${list} from '${spec.from}'`;
  }

  if (spec.as) {
    return `import ${spec.as} from '${spec.from}'`;
  }

  return `import '${spec.from}'`;
}
