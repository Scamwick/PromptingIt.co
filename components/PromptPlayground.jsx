// PromptPlayground.jsx - Interactive Prompt Testing Component for PromptingIt.co
// UI/UX Enhancement Package - Created for landing page

import React, { useState } from 'react';

const MODELS = [
  { id: 'claude-3-opus', name: 'Claude Opus', color: '#D97706' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', color: '#10B981' },
  { id: 'gemini-pro', name: 'Gemini Pro', color: '#3B82F6' },
  ];

const SAMPLE_PROMPTS = [
  {
        id: 'code-review',
        name: 'Code Review Assistant',
        version: 'v2.4.1',
        content: `You are an expert code reviewer. Analyze the following {{language}} code for:
        - Security vulnerabilities
        - Performance issues
        - Best practice violations

        Code to review:
        \`\`\`{{language}}
        {{code}}
        \`\`\``,
        variables: { language: 'TypeScript', code: 'const data = eval(userInput);' },
  },
  {
        id: 'sql-generator',
        name: 'SQL Query Generator', 
        version: 'v1.8.0',
        content: `Convert this request into SQL: {{request}}`,
        variables: { request: 'Get top 10 customers' },
  },
  ];

export function PromptPlayground() {
    const [selectedPrompt, setSelectedPrompt] = useState(SAMPLE_PROMPTS[0]);
    const [activeModels, setActiveModels] = useState(['claude-3-opus', 'gpt-4-turbo']);
    const [results, setResults] = useState([]);
    const [isRunning, setIsRunning] = useState(false);

  const toggleModel = (modelId) => {
        setActiveModels(prev => 
                              prev.includes(modelId) ? prev.filter(m => m !== modelId) : [...prev, modelId]
                            );
  };

  const simulateTest = async () => {
        setIsRunning(true);
        setResults([]);

        for (const modelId of activeModels) {
                const model = MODELS.find(m => m.id === modelId);
                await new Promise(r => setTimeout(r, 800 + Math.random() * 800));

          const tokens = 150 + Math.floor(Math.random() * 200);
                setResults(prev => [...prev, {
                          model: modelId,
                          modelName: model.name,
                          output: `[${model.name}] Analysis complete. Found 2 issues...`,
                          cost: (tokens * 0.00003).toFixed(4),
                          latency: Math.floor(200 + Math.random() * 400),
                          tokens,
                }]);
        }
        setIsRunning(false);
  };

  return (
        <div className="playground-container">
              <div className="playground-header">
                      <div className="window-controls">
                                <span className="dot red"></span>span>
                                <span className="dot yellow"></span>span>
                                <span className="dot green"></span>span>
                      </div>div>
                      <span className="title">Prompt Playground</span>span>
                      <select 
                                  value={selectedPrompt.id}
                                  onChange={(e) => setSelectedPrompt(SAMPLE_PROMPTS.find(p => p.id === e.target.value))}
                                  className="prompt-select"
                                >
                        {SAMPLE_PROMPTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>option>)}
                      </select>select>
                      <span className="version-badge">{selectedPrompt.version}</span>span>
              </div>div>
        
              <div className="playground-content">
                      <div className="editor-panel">
                                <h3>Prompt Template</h3>h3>
                                <pre className="code-display">
                                  {selectedPrompt.content.split(/({{.*?}})/g).map((part, i) => 
                        part.startsWith('{{') 
                          ? <span key={i} className="variable">{part}</span>span>
                          : <span key={i}>{part}</span>span>
                                            )}
                                </pre>pre>
                                <div className="variables">
                                            <h4>Variables</h4>h4>
                                  {Object.entries(selectedPrompt.variables).map(([k, v]) => (
                        <span key={k} className="var-tag">{k}: {String(v).slice(0,15)}...</span>span>
                      ))}
                                </div>div>
                      </div>div>
              
                      <div className="testing-panel">
                                <div className="panel-header">
                                            <h3>Test Across Models</h3>h3>
                                            <button 
                                                            onClick={simulateTest} 
                                              disabled={isRunning || !activeModels.length}
                                                            className="run-btn"
                                                          >
                                              {isRunning ? 'Testing...' : '⚡ Run Test'}
                                            </button>button>
                                </div>div>
                      
                                <div className="model-selector">
                                  {MODELS.map(model => (
                        <button
                                          key={model.id}
                                          onClick={() => toggleModel(model.id)}
                                          className={`model-btn ${activeModels.includes(model.id) ? 'active' : ''}`}
                                        >
                                        <span className="model-dot" style={{backgroundColor: model.color}}></span>span>
                          {model.name}
                        </button>button>
                      ))}
                                </div>div>
                      
                                <div className="results">
                                  {results.map((r, i) => (
                        <div key={i} className="result-card">
                                        <div className="result-header">
                                                          <span className="model-name">{r.modelName}</span>span>
                                                          <div className="metrics">
                                                                              <span className="cost">${r.cost}</span>span>
                                                                              <span className="latency">{r.latency}ms</span>span>
                                                                              <span className="tokens">{r.tokens} tok</span>span>
                                                          </div>div>
                                        </div>div>
                                        <p className="output">{r.output}</p>p>
                        </div>div>
                      ))}
                                  {!results.length && !isRunning && (
                        <div className="empty-state">
                                        <span>⚡</span>span>
                                        <p>Select models and click "Run Test"</p>p>
                        </div>div>
                                            )}
                                </div>div>
                      </div>div>
              </div>div>
        
              <div className="playground-footer">
                      <p>💡 Preview mode. Sign up to save and deploy prompts.</p>p>
                      <button className="cta-btn">Start Free →</button>button>
              </div>div>
        </div>div>
      );
}

export default PromptPlayground;</div>
