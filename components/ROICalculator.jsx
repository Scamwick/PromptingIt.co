// ROICalculator.jsx - Calculate savings from using PromptingIt
// UI/UX Enhancement Package

import React, { useState, useMemo } from 'react';

export function ROICalculator() {
    const [inputs, setInputs] = useState({
          teamSize: 5,
          promptCount: 50,
          hoursPerWeek: 10,
          incidentsPerMonth: 2,
          hourlyRate: 75,
    });

  const calculations = useMemo(() => {
        const { teamSize, hoursPerWeek, incidentsPerMonth, hourlyRate } = inputs;

                                   // Current costs
                                   const managementCost = hoursPerWeek * hourlyRate * 52;
        const incidentCost = incidentsPerMonth * 2500 * 12;
        const currentTotal = managementCost + incidentCost;

                                   // With PromptingIt (60% time savings, 80% incident reduction)
                                   const promptingItCost = teamSize * 49 * 12 * 0.8;
        const newManagement = managementCost * 0.4;
        const newIncidents = incidentCost * 0.2;
        const newTotal = newManagement + newIncidents + promptingItCost;

                                   const savings = currentTotal - newTotal;
        const roi = (savings / promptingItCost) * 100;
        const hoursSaved = hoursPerWeek * 0.6 * 52;
        const incidentsPrevented = Math.round(incidentsPerMonth * 0.8 * 12);
        const paybackDays = Math.round((promptingItCost / savings) * 365);

                                   return { savings, roi, hoursSaved, incidentsPrevented, paybackDays, promptingItCost };
  }, [inputs]);

  const handleChange = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
        <section className="roi-calculator">
              <div className="roi-header">
                      <span className="badge">💰 ROI CALCULATOR</span>span>
                      <h2>Calculate Your Savings</h2>h2>
                      <p>See how much time and money you could save with PromptingIt</p>p>
              </div>div>
        
              <div className="roi-content">
                      <div className="inputs-panel">
                                <h3>Your Current Setup</h3>h3>
                                
                                <div className="input-group">
                                            <label>
                                                          <span>Team members</span>span>
                                                          <span className="value">{inputs.teamSize}</span>span>
                                            </label>label>
                                            <input type="range" min="1" max="50" value={inputs.teamSize}
                                                            onChange={(e) => handleChange('teamSize', parseInt(e.target.value))} />
                                </div>div>
                      
                                <div className="input-group">
                                            <label>
                                                          <span>Prompts managed</span>span>
                                                          <span className="value">{inputs.promptCount}</span>span>
                                            </label>label>
                                            <input type="range" min="10" max="500" step="10" value={inputs.promptCount}
                                                            onChange={(e) => handleChange('promptCount', parseInt(e.target.value))} />
                                </div>div>
                      
                                <div className="input-group">
                                            <label>
                                                          <span>Hours/week managing</span>span>
                                                          <span className="value">{inputs.hoursPerWeek}h</span>span>
                                            </label>label>
                                            <input type="range" min="1" max="40" value={inputs.hoursPerWeek}
                                                            onChange={(e) => handleChange('hoursPerWeek', parseInt(e.target.value))} />
                                </div>div>
                      
                                <div className="input-group">
                                            <label>
                                                          <span>Incidents/month</span>span>
                                                          <span className="value">{inputs.incidentsPerMonth}</span>span>
                                            </label>label>
                                            <input type="range" min="0" max="10" value={inputs.incidentsPerMonth}
                                                            onChange={(e) => handleChange('incidentsPerMonth', parseInt(e.target.value))} />
                                </div>div>
                      
                                <div className="input-group">
                                            <label>
                                                          <span>Hourly rate ($)</span>span>
                                                          <span className="value">${inputs.hourlyRate}</span>span>
                                            </label>label>
                                            <input type="range" min="25" max="250" step="5" value={inputs.hourlyRate}
                                                            onChange={(e) => handleChange('hourlyRate', parseInt(e.target.value))} />
                                </div>div>
                      </div>div>
              
                      <div className="results-panel">
                                <h3>Your Projected Savings</h3>h3>
                                
                                <div className="savings-card highlight">
                                            <span className="label">Annual Savings</span>span>
                                            <span className="amount">${Math.round(calculations.savings).toLocaleString()}</span>span>
                                </div>div>
                      
                                <div className="savings-card">
                                            <span className="label">ROI</span>span>
                                            <span className="amount roi">{Math.round(calculations.roi)}%</span>span>
                                </div>div>
                      
                                <div className="stats-grid">
                                            <div className="stat">
                                                          <span className="stat-value">{Math.round(calculations.hoursSaved)}</span>span>
                                                          <span className="stat-label">Hours Saved/Year</span>span>
                                            </div>div>
                                            <div className="stat">
                                                          <span className="stat-value">{calculations.incidentsPrevented}</span>span>
                                                          <span className="stat-label">Incidents Prevented</span>span>
                                            </div>div>
                                            <div className="stat">
                                                          <span className="stat-value">{calculations.paybackDays}</span>span>
                                                          <span className="stat-label">Payback (days)</span>span>
                                            </div>div>
                                            <div className="stat">
                                                          <span className="stat-value">${Math.round(calculations.promptingItCost).toLocaleString()}</span>span>
                                                          <span className="stat-label">Annual Cost</span>span>
                                            </div>div>
                                </div>div>
                      
                                <p className="disclaimer">* Based on 60% time reduction, 80% fewer incidents</p>p>
                      </div>div>
              </div>div>
        </section>section>
      );
}

export default ROICalculator;</section>
