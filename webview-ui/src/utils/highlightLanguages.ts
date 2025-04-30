import hljs from 'highlight.js/lib/core';

// 基础语言
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import sql from 'highlight.js/lib/languages/sql';

// 系统/编译语言
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';

// Shell相关
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import powershell from 'highlight.js/lib/languages/powershell';

// Web相关
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';

// 构建和配置文件
import yaml from 'highlight.js/lib/languages/yaml';
import cmake from 'highlight.js/lib/languages/cmake';
import makefile from 'highlight.js/lib/languages/makefile';

export function registerLanguages() {
  // 基础语言
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('cs', csharp);
  hljs.registerLanguage('sql', sql);
  
  // 系统/编译语言
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('c', c);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('go', go);
  
  // Shell相关
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', shell);
  hljs.registerLanguage('powershell', powershell);
  
  // Web相关
  hljs.registerLanguage('html', xml);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('markdown', markdown);
  
  // 构建和配置文件
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('yml', yaml);
  hljs.registerLanguage('cmake', cmake);
  hljs.registerLanguage('makefile', makefile);
  hljs.registerLanguage('make', makefile);
}
