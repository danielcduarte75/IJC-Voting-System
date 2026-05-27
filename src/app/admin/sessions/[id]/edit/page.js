'use client';

import { useState, useEffect, use } from 'react';
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

export default function EditSessionPage({ params }) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [originalCategories, setOriginalCategories] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Fetch session
      const { data: session, error: sessionError } = await supabase
        .from('voting_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (sessionError || !session) {
        console.error(sessionError);
        router.push('/admin');
        return;
      }
      
      if (session.is_active) {
        router.push(`/admin/sessions/${sessionId}`);
        return;
      }

      setTitle(session.title);
      setDescription(session.description || '');

      // Fetch categories & options
      const { data: cats, error: catsError } = await supabase
        .from('voting_categories')
        .select(`
          id, name, display_order,
          voting_options ( id, name, display_order )
        `)
        .eq('session_id', sessionId)
        .order('display_order');
        
      if (!catsError && cats) {
        const loaded = cats.map(cat => ({
          id: cat.id,
          name: cat.name,
          options: (cat.voting_options || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map(o => ({ id: o.id, name: o.name }))
        }));
        setCategories(loaded);
        setOriginalCategories(loaded);
      }
      
      setLoading(false);
    }
    fetchData();
  }, [sessionId, router]);

  function addCategory() {
    setCategories([...categories, createEmptyCategory()]);
  }

  function removeCategory(catId) {
    if (categories.length <= 1) return;
    setCategories(categories.filter((c) => c.id !== catId));
    checkWarnings(categories.filter((c) => c.id !== catId));
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
    const newCats = categories.map((c) =>
      c.id === catId
        ? { ...c, options: c.options.filter((o) => o.id !== optId) }
        : c
    );
    setCategories(newCats);
    checkWarnings(newCats);
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
  
  function checkWarnings(currentCats) {
    const originalOptionIds = originalCategories.flatMap(c => c.options.map(o => o.id));
    const currentOptionIds = currentCats.flatMap(c => c.options.map(o => o.id));
    const deletedOptionIds = originalOptionIds.filter(id => !currentOptionIds.includes(id));
    
    if (deletedOptionIds.length > 0) {
      setWarning('Aviso: Ao remover categorias ou opções já existentes, quaisquer votos associados a elas serão apagados permanentemente.');
    } else {
      setWarning('');
    }
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
      
      // 1. Update session
      const { error: sessionError } = await supabase
        .from('voting_sessions')
        .update({
          title: title.trim(),
          description: description.trim() || null,
        })
        .eq('id', sessionId);
        
      if (sessionError) throw sessionError;

      // 2. Find deleted items
      const originalCatIds = originalCategories.map(c => c.id);
      const currentCatIds = categories.map(c => c.id);
      const deletedCatIds = originalCatIds.filter(id => !currentCatIds.includes(id));
      
      const originalOptIds = originalCategories.flatMap(c => c.options.map(o => o.id));
      const currentOptIds = categories.flatMap(c => c.options.map(o => o.id));
      const deletedOptIds = originalOptIds.filter(id => !currentOptIds.includes(id));
      
      // 3. Delete removed options first, then categories
      if (deletedOptIds.length > 0) {
        const { error } = await supabase.from('voting_options').delete().in('id', deletedOptIds);
        if (error) throw error;
      }
      if (deletedCatIds.length > 0) {
        const { error } = await supabase.from('voting_categories').delete().in('id', deletedCatIds);
        if (error) throw error;
      }
      
      // 4. Upsert Categories
      const categoriesToUpsert = categories.map((cat, i) => ({
        id: cat.id,
        session_id: sessionId,
        name: cat.name.trim(),
        display_order: i,
      }));
      const { error: catError } = await supabase.from('voting_categories').upsert(categoriesToUpsert);
      if (catError) throw catError;
      
      // 5. Upsert Options
      const optionsToUpsert = categories.flatMap((cat) => 
        cat.options.map((opt, j) => ({
          id: opt.id,
          category_id: cat.id,
          name: opt.name.trim(),
          display_order: j,
        }))
      );
      const { error: optError } = await supabase.from('voting_options').upsert(optionsToUpsert);
      if (optError) throw optError;

      router.push(`/admin/sessions/${sessionId}`);
      router.refresh();
    } catch (err) {
      console.error('Error updating session:', err);
      setError('Ocorreu um erro ao atualizar a votação. Verifique a consola.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Editar Votação</h1>
          <p className="admin-page-subtitle">Modifique as categorias e opções</p>
        </div>
        <Link href={`/admin/sessions/${sessionId}`} className="btn btn-secondary">
          Cancelar
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label className="label">Título da Votação</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Assembleia Geral - Maio 2026"
            />
          </div>

          <div className="form-group">
            <label className="label">Descrição (Opcional)</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instruções ou notas adicionais..."
              rows={3}
            />
          </div>
        </div>

        {categories.map((cat, catIndex) => (
          <div key={cat.id} className="card stagger-children" style={{ marginBottom: 24, animationDelay: `${catIndex * 100}ms` }}>
            <div className="form-section-title">
              Categoria {catIndex + 1}
              {categories.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: 'var(--danger)', marginLeft: 'auto', fontSize: 14 }}
                  onClick={() => removeCategory(cat.id)}
                >
                  Remover Categoria
                </button>
              )}
            </div>

            <div className="form-group">
              <label className="label">Nome da Categoria</label>
              <input
                type="text"
                className="input"
                value={cat.name}
                onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                placeholder="Ex: Direção"
              />
            </div>

            <div className="options-container" style={{ marginLeft: 24, paddingLeft: 24, borderLeft: '2px solid var(--gray-100)' }}>
              <label className="label" style={{ marginBottom: 12 }}>Opções de Voto</label>
              
              {cat.options.map((opt, optIndex) => (
                <div key={opt.id} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <input
                    type="text"
                    className="input"
                    value={opt.name}
                    onChange={(e) => updateOptionName(cat.id, opt.id, e.target.value)}
                    placeholder={`Opção ${optIndex + 1}`}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removeOption(cat.id, opt.id)}
                    disabled={cat.options.length <= 1}
                    title="Remover opção"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 8 }}
                onClick={() => addOption(cat.id)}
              >
                + Adicionar Opção
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addCategory}
          >
            + Adicionar Nova Categoria
          </button>
        </div>

        {warning && (
          <div className="badge badge-warning" style={{ display: 'block', padding: 16, marginBottom: 24, fontSize: 14 }}>
            {warning}
          </div>
        )}
        
        {error && (
          <div className="badge badge-danger" style={{ display: 'block', padding: 16, marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 80 }}>
          <Link href={`/admin/sessions/${sessionId}`} className="btn btn-secondary">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'A gravar...' : 'Gravar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
