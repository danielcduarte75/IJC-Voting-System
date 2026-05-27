'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

function createEmptyOption(name = '') {
  return { id: crypto.randomUUID(), name };
}

function createEmptyCategory() {
  return {
    id: crypto.randomUUID(),
    name: '',
    options: [
      createEmptyOption('Voto em Branco'),
    ],
  };
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState([createEmptyCategory()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addCategory() {
    setCategories([...categories, createEmptyCategory()]);
  }

  function removeCategory(catId) {
    if (categories.length <= 1) return;
    setCategories(categories.filter((c) => c.id !== catId));
  }

  function updateCategoryName(catId, name) {
    setCategories(categories.map((c) =>
      c.id === catId ? { ...c, name } : c
    ));
  }

  function addOption(catId) {
    setCategories(categories.map((c) =>
      c.id === catId
        ? { ...c, options: [...c.options, createEmptyOption()] }
        : c
    ));
  }

  function removeOption(catId, optId) {
    setCategories(categories.map((c) =>
      c.id === catId
        ? { ...c, options: c.options.filter((o) => o.id !== optId) }
        : c
    ));
  }

  function updateOptionName(catId, optId, name) {
    setCategories(categories.map((c) =>
      c.id === catId
        ? {
            ...c,
            options: c.options.map((o) =>
              o.id === optId ? { ...o, name } : o
            ),
          }
        : c
    ));
  }

  function validate() {
    if (!title.trim()) {
      setError('O título da votação é obrigatório.');
      return false;
    }
    if (categories.length < 1) {
      setError('Adicione pelo menos uma categoria.');
      return false;
    }

    const catNames = new Set();

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const catNameTrimmed = cat.name.trim();

      if (!catNameTrimmed) {
        setError(`A categoria ${i + 1} precisa de um nome.`);
        return false;
      }

      const lowerCatName = catNameTrimmed.toLowerCase();
      if (catNames.has(lowerCatName)) {
        setError(`A categoria "${catNameTrimmed}" está duplicada. Os nomes das categorias têm de ser únicos.`);
        return false;
      }
      catNames.add(lowerCatName);

      if (cat.options.length < 2) {
        setError(`A categoria "${catNameTrimmed}" precisa de pelo menos 2 opções.`);
        return false;
      }

      const optNames = new Set();
      for (let j = 0; j < cat.options.length; j++) {
        const optNameTrimmed = cat.options[j].name.trim();

        if (!optNameTrimmed) {
          setError(`Todas as opções da categoria "${catNameTrimmed}" precisam de um nome.`);
          return false;
        }

        const lowerOptName = optNameTrimmed.toLowerCase();
        if (optNames.has(lowerOptName)) {
          setError(`A opção "${optNameTrimmed}" está duplicada na categoria "${catNameTrimmed}".`);
          return false;
        }
        optNames.add(lowerOptName);
      }
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setSaving(true);

    try {
      const supabase = createClient();

      // 1. Create session
      const { data: session, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          is_active: false,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Create categories
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        const { data: categoryData, error: catError } = await supabase
          .from('voting_categories')
          .insert({
            session_id: session.id,
            name: cat.name.trim(),
            display_order: i,
          })
          .select()
          .single();

        if (catError) throw catError;

        // 3. Create options for this category
        const optionsToInsert = cat.options.map((opt, j) => ({
          category_id: categoryData.id,
          name: opt.name.trim(),
          display_order: j,
        }));

        const { error: optError } = await supabase
          .from('voting_options')
          .insert(optionsToInsert);

        if (optError) throw optError;
      }

      router.push(`/admin/sessions/${session.id}`);
    } catch (err) {
      console.error('Error creating session:', err);
      setError('Ocorreu um erro ao criar a votação. Tente novamente.');
      setSaving(false);
    }
  }

  return (
    <div className="form-page">
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/admin" className="session-back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div>
            <h1 className="admin-page-title">Nova Votação</h1>
            <p className="admin-page-subtitle">Configure a sessão de votação</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Session Info */}
        <div className="card form-section">
          <div className="form-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Informação da Sessão
          </div>
          <div className="form-group">
            <label className="label" htmlFor="title">Título *</label>
            <input
              id="title"
              type="text"
              className="input"
              placeholder="Ex: Assembleia Geral 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="description">Descrição (opcional)</label>
            <textarea
              id="description"
              className="textarea"
              placeholder="Breve descrição da votação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="form-section">
          <div className="form-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Categorias e Opções
          </div>

          {categories.map((cat, catIdx) => (
            <div key={cat.id} className="category-card">
              <div className="category-card-header">
                <span className="category-number">{catIdx + 1}</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Nome da categoria (ex: Presidente)"
                  value={cat.name}
                  onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                />
                <button
                  type="button"
                  className="category-remove-btn"
                  onClick={() => removeCategory(cat.id)}
                  title="Remover categoria"
                  disabled={categories.length <= 1}
                  style={categories.length <= 1 ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>

              <div className="options-section">
                <div className="options-section-title">Opções</div>
                {cat.options.map((opt) => (
                  <div key={opt.id} className="option-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="Nome da opção"
                      value={opt.name}
                      onChange={(e) => updateOptionName(cat.id, opt.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="option-remove-btn"
                      onClick={() => removeOption(cat.id, opt.id)}
                      title="Remover opção"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-option-btn"
                  onClick={() => addOption(cat.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Adicionar Opção
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="add-category-btn"
            onClick={addCategory}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar Categoria
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                A criar...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Criar Votação
              </>
            )}
          </button>
          <Link href="/admin" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
