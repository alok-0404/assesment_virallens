import { Children, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from './CopyButton.jsx';

function CodeBlock({ code, language }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-1 text-xs text-slate-400">
        <span>{language || 'code'}</span>
        <CopyButton text={code} label="Copy code" className="text-slate-300 hover:bg-slate-800 hover:text-white" />
      </div>
      <pre className="overflow-x-auto p-3 text-[0.8rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const components = {
  // eslint-disable-next-line no-unused-vars
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  pre: ({ children }) => {
    const child = Children.toArray(children).find(isValidElement);
    const className = child?.props?.className ?? '';
    const language = /language-([\w+#-]+)/.exec(className)?.[1];
    const code = String(child?.props?.children ?? '').replace(/\n$/, '');
    return <CodeBlock code={code} language={language} />;
  },
  // eslint-disable-next-line no-unused-vars
  code: ({ node, className, ...props }) => (
    <code className={`md-inline-code ${className ?? ''}`.trim()} {...props} />
  ),
};

/** Renders assistant Markdown. Raw HTML is skipped, so model output cannot inject markup. */
export default function MarkdownContent({ content }) {
  return (
    <div className="markdown break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}
