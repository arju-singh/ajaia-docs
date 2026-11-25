import { useEditorState } from '@tiptap/react';

export default function Toolbar({ editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  const blockValue = state.h1 ? 'h1' : state.h2 ? 'h2' : state.h3 ? 'h3' : 'p';
  const setBlock = (value) => {
    if (value === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(value[1]) }).run();
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo (⌘Z)" onClick={() => chain().undo().run()} disabled={!state.canUndo}>↶</Btn>
      <Btn label="Redo (⌘⇧Z)" onClick={() => chain().redo().run()} disabled={!state.canRedo}>↷</Btn>
      <Sep />
      <select className="block-select" value={blockValue} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Sep />
      <Btn label="Bold (⌘B)" active={state.bold} onClick={() => chain().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic (⌘I)" active={state.italic} onClick={() => chain().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline (⌘U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}><s>S</s></Btn>
      <Sep />
      <Btn label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>• ≡</Btn>
      <Btn label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>1. ≡</Btn>
      <Btn label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>❝</Btn>
      <Btn label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>⌫</Btn>
    </div>
  );
}

function Btn({ label, active, disabled, onClick, children }) {
  return (
    <button type="button" className={`tool${active ? ' active' : ''}`} title={label} aria-label={label}
      aria-pressed={active ?? undefined} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

const Sep = () => <span className="tool-sep" aria-hidden />;
