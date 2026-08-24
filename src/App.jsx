import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

const SPECIES_OPTIONS = [
  'White-tailed Deer',
  'Eastern Cottontail',
  'Eastern Gray Squirrel',
  'Red Squirrel',
  'Raccoon',
  'Virginia Opossum',
  'Striped Skunk',
  'Red Fox',
  'Gray Fox',
  'Coyote',
  'Bobcat',
  'Groundhog',
  'Porcupine',
  'Wild Turkey',
  'Other',
  'Unknown',
]

const BEHAVIOR_OPTIONS = [
  'Traveling',
  'Feeding / Foraging',
  'Investigating',
  'Resting',
  'Interacting',
  'Other',
  'Unknown',
]

const WEATHER_OPTIONS = [
  'Clear',
  'Partly Cloudy',
  'Cloudy',
  'Rain',
  'Snow',
  'Fog',
  'Windy',
  'Other',
]

const TEMP_OPTIONS = [
  'Below 20°F',
  '20–39°F',
  '40–59°F',
  '60–79°F',
  '80°F+',
]

const TIME_OPTIONS = ['Dawn', 'Day', 'Dusk', 'Night']

const emptyObservation = () => ({
  observation_date: new Date().toISOString().slice(0, 10),
  observation_time: '',
  time_category: '',
  location_type: '',
  camera_id: '',
  species: [],
  total_animals: '',
  behavior: '',
  other_behavior: '',
  weather: '',
  temperature_range: '',
  notes: '',
  photo: null,
})

const emptyInsight = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  observation_start_date: '',
  observation_end_date: '',
  most_common_species: '',
  most_active_time_category: '',
  location_differences: '',
  behavior_patterns: '',
  unexpected_observations: '',
  summary_conclusion: '',
})

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [activeTab, setActiveTab] = useState('dashboard')
  const [observations, setObservations] = useState([])
  const [insights, setInsights] = useState([])
  const [observationForm, setObservationForm] = useState(emptyObservation())
  const [insightForm, setInsightForm] = useState(emptyInsight())
  const [editingObservationId, setEditingObservationId] = useState(null)
  const [editingInsightId, setEditingInsightId] = useState(null)

  const [loadingData, setLoadingData] = useState(false)
  const [savingObservation, setSavingObservation] = useState(false)
  const [savingInsight, setSavingInsight] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setAuthLoading(false)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      loadAllData()
    } else {
      setObservations([])
      setInsights([])
    }
  }, [session?.user?.id])

  async function loadAllData() {
    setLoadingData(true)
    setNotice('')

    const [observationResult, insightResult] = await Promise.all([
      supabase
        .from('observations')
        .select('*')
        .order('observation_date', { ascending: false })
        .order('observation_time', { ascending: false }),

      supabase
        .from('insights')
        .select('*')
        .order('entry_date', { ascending: false }),
    ])

    if (observationResult.error || insightResult.error) {
      setNotice(
        `Could not load saved data. ${
          observationResult.error?.message ||
          insightResult.error?.message ||
          ''
        }`
      )
    } else {
      setObservations(observationResult.data || [])
      setInsights(insightResult.data || [])
    }

    setLoadingData(false)
  }

  async function signIn(event) {
    event.preventDefault()
    setAuthMessage('Signing in…')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setAuthMessage(error.message)
    } else {
      setAuthMessage('')
      setEmail('')
      setPassword('')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4500)
  }

  function toggleSpecies(speciesName) {
    setObservationForm((current) => {
      const alreadySelected = current.species.includes(speciesName)

      return {
        ...current,
        species: alreadySelected
          ? current.species.filter((item) => item !== speciesName)
          : [...current.species, speciesName],
      }
    })
  }

  function handleLocationChange(location) {
    setObservationForm((current) => ({
      ...current,
      location_type: location,
      camera_id: location === 'Backyard' ? 'B1' : '',
    }))
  }

  async function uploadPhoto(file, userId, observationId) {
    if (!file) return null

    const extension = file.name?.split('.').pop() || 'jpg'
    const safeExtension = extension.toLowerCase()
    const path = `${userId}/${observationId}.${safeExtension}`

    const { error } = await supabase.storage
      .from('wildlife-photos')
      .upload(path, file, { upsert: true })

    if (error) throw error

    return path
  }

  async function saveObservation(event) {
    event.preventDefault()

    if (!session?.user?.id) return

    if (
      !observationForm.observation_date ||
      !observationForm.observation_time ||
      !observationForm.time_category ||
      !observationForm.location_type ||
      !observationForm.camera_id ||
      observationForm.species.length === 0 ||
      !observationForm.total_animals ||
      !observationForm.behavior
    ) {
      showNotice('Please complete all required observation fields.')
      return
    }

    setSavingObservation(true)

    try {
      const payload = {
        user_id: session.user.id,
        observation_date: observationForm.observation_date,
        observation_time: observationForm.observation_time,
        time_category: observationForm.time_category,
        location_type: observationForm.location_type,
        camera_id: observationForm.camera_id,
        species: observationForm.species,
        total_animals: observationForm.total_animals,
        behavior: observationForm.behavior,
        other_behavior:
          observationForm.behavior === 'Other'
            ? observationForm.other_behavior.trim() || null
            : null,
        weather: observationForm.weather || null,
        temperature_range: observationForm.temperature_range || null,
        notes: observationForm.notes.trim() || null,
      }

      let savedRecord

      if (editingObservationId) {
        const { data, error } = await supabase
          .from('observations')
          .update(payload)
          .eq('id', editingObservationId)
          .select()
          .single()

        if (error) throw error
        savedRecord = data
      } else {
        const { data, error } = await supabase
          .from('observations')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        savedRecord = data
      }

      if (observationForm.photo) {
        const photoPath = await uploadPhoto(
          observationForm.photo,
          session.user.id,
          savedRecord.id
        )

        const { error: photoUpdateError } = await supabase
          .from('observations')
          .update({ photo_path: photoPath })
          .eq('id', savedRecord.id)

        if (photoUpdateError) throw photoUpdateError
      }

      setObservationForm(emptyObservation())
      setEditingObservationId(null)
      await loadAllData()
      setActiveTab('observations')
      showNotice('Observation saved to the cloud.')
    } catch (error) {
      showNotice(`Observation was NOT saved. ${error.message}`)
    } finally {
      setSavingObservation(false)
    }
  }

  function beginEditObservation(observation) {
    setObservationForm({
      observation_date: observation.observation_date || '',
      observation_time: (observation.observation_time || '').slice(0, 5),
      time_category: observation.time_category || '',
      location_type: observation.location_type || '',
      camera_id: observation.camera_id || '',
      species: observation.species || [],
      total_animals: observation.total_animals || '',
      behavior: observation.behavior || '',
      other_behavior: observation.other_behavior || '',
      weather: observation.weather || '',
      temperature_range: observation.temperature_range || '',
      notes: observation.notes || '',
      photo: null,
    })

    setEditingObservationId(observation.id)
    setActiveTab('new')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteObservation(observation) {
    const confirmed = window.confirm(
      `Delete this ${
        observation.species?.join(', ') || 'wildlife'
      } observation? This cannot be undone.`
    )

    if (!confirmed) return

    try {
      if (observation.photo_path) {
        await supabase.storage
          .from('wildlife-photos')
          .remove([observation.photo_path])
      }

      const { error } = await supabase
        .from('observations')
        .delete()
        .eq('id', observation.id)

      if (error) throw error

      await loadAllData()
      showNotice('Observation deleted.')
    } catch (error) {
      showNotice(`Could not delete observation. ${error.message}`)
    }
  }

  async function saveInsight(event) {
    event.preventDefault()

    if (!session?.user?.id || !insightForm.entry_date) {
      showNotice('Entry date is required.')
      return
    }

    setSavingInsight(true)

    const payload = {
      user_id: session.user.id,
      entry_date: insightForm.entry_date,
      observation_start_date: insightForm.observation_start_date || null,
      observation_end_date: insightForm.observation_end_date || null,
      most_common_species: insightForm.most_common_species.trim() || null,
      most_active_time_category:
        insightForm.most_active_time_category.trim() || null,
      location_differences: insightForm.location_differences.trim() || null,
      behavior_patterns: insightForm.behavior_patterns.trim() || null,
      unexpected_observations:
        insightForm.unexpected_observations.trim() || null,
      summary_conclusion: insightForm.summary_conclusion.trim() || null,
    }

    try {
      if (editingInsightId) {
        const { error } = await supabase
          .from('insights')
          .update(payload)
          .eq('id', editingInsightId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('insights').insert(payload)
        if (error) throw error
      }

      setInsightForm(emptyInsight())
      setEditingInsightId(null)
      await loadAllData()
      showNotice('Insight saved to the cloud.')
    } catch (error) {
      showNotice(`Insight was NOT saved. ${error.message}`)
    } finally {
      setSavingInsight(false)
    }
  }

  function beginEditInsight(insight) {
    setInsightForm({
      entry_date: insight.entry_date || '',
      observation_start_date: insight.observation_start_date || '',
      observation_end_date: insight.observation_end_date || '',
      most_common_species: insight.most_common_species || '',
      most_active_time_category: insight.most_active_time_category || '',
      location_differences: insight.location_differences || '',
      behavior_patterns: insight.behavior_patterns || '',
      unexpected_observations: insight.unexpected_observations || '',
      summary_conclusion: insight.summary_conclusion || '',
    })

    setEditingInsightId(insight.id)
    setActiveTab('insights')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteInsight(insight) {
    if (!window.confirm('Delete this insight entry? This cannot be undone.')) {
      return
    }

    const { error } = await supabase
      .from('insights')
      .delete()
      .eq('id', insight.id)

    if (error) {
      showNotice(`Could not delete insight. ${error.message}`)
    } else {
      await loadAllData()
      showNotice('Insight deleted.')
    }
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '""'
    const text = Array.isArray(value) ? value.join('; ') : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }

  function downloadCsv(filename, headers, rows) {
    const csv = [
      headers.map((header) => csvEscape(header.label)).join(','),
      ...rows.map((row) =>
        headers.map((header) => csvEscape(row[header.key])).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function exportObservations() {
    downloadCsv(
      `wildlife-observations-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'observation_date', label: 'Observation Date' },
        { key: 'observation_time', label: 'Exact Time' },
        { key: 'time_category', label: 'Time Category' },
        { key: 'location_type', label: 'Location' },
        { key: 'camera_id', label: 'Camera ID' },
        { key: 'species', label: 'Species' },
        { key: 'total_animals', label: 'Total Animals' },
        { key: 'behavior', label: 'Behavior' },
        { key: 'other_behavior', label: 'Other Behavior' },
        { key: 'weather', label: 'Weather' },
        { key: 'temperature_range', label: 'Temperature Range' },
        { key: 'notes', label: 'Notes' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Updated At' },
      ],
      observations
    )
  }

  function exportInsights() {
    downloadCsv(
      `wildlife-insights-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'entry_date', label: 'Entry Date' },
        { key: 'observation_start_date', label: 'Observation Start Date' },
        { key: 'observation_end_date', label: 'Observation End Date' },
        { key: 'most_common_species', label: 'Most Common Species' },
        {
          key: 'most_active_time_category',
          label: 'Most Active Time Category',
        },
        {
          key: 'location_differences',
          label: 'Backyard vs. Lake Differences',
        },
        { key: 'behavior_patterns', label: 'Behavior Patterns' },
        { key: 'unexpected_observations', label: 'Unexpected Observations' },
        { key: 'summary_conclusion', label: 'Summary / Conclusion' },
        { key: 'created_at', label: 'Created At' },
        { key: 'updated_at', label: 'Updated At' },
      ],
      insights
    )
  }

  const stats = useMemo(() => {
    const speciesCounts = {}
    const behaviorCounts = {}
    const timeCounts = {}

    observations.forEach((observation) => {
      ;(observation.species || []).forEach((speciesName) => {
        speciesCounts[speciesName] = (speciesCounts[speciesName] || 0) + 1
      })

      behaviorCounts[observation.behavior] =
        (behaviorCounts[observation.behavior] || 0) + 1

      timeCounts[observation.time_category] =
        (timeCounts[observation.time_category] || 0) + 1
    })

    const highest = (object) => {
      const entries = Object.entries(object)
      if (!entries.length) return '—'
      entries.sort((a, b) => b[1] - a[1])
      return entries[0][0]
    }

    return {
      total: observations.length,
      backyard: observations.filter(
        (observation) => observation.location_type === 'Backyard'
      ).length,
      lake: observations.filter(
        (observation) => observation.location_type === 'Lake'
      ).length,
      topSpecies: highest(speciesCounts),
      topBehavior: highest(behaviorCounts),
      topTime: highest(timeCounts),
    }
  }, [observations])

  if (authLoading) {
    return (
      <div className="app-shell centered-screen">
        <div className="loading-card">Loading Wildlife Tracker…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app-shell centered-screen">
        <div className="login-card">
          <div className="brand-mark">WT</div>
          <p className="eyebrow">FIELD OBSERVATION</p>
          <h1>Wildlife Tracker</h1>
          <p className="login-intro">
            Sign in to access the wildlife observation study.
          </p>

          <form onSubmit={signIn} className="stack">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button className="primary-button" type="submit">
              Sign In
            </button>
          </form>

          {authMessage && <p className="message">{authMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">FIELD OBSERVATION</p>
          <h1>Wildlife Tracker</h1>
        </div>

        <button className="text-button" onClick={signOut}>
          Sign Out
        </button>
      </header>

      <nav className="tab-bar">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Home
        </button>
        <button
          className={activeTab === 'new' ? 'active' : ''}
          onClick={() => {
            setObservationForm(emptyObservation())
            setEditingObservationId(null)
            setActiveTab('new')
          }}
        >
          Add
        </button>
        <button
          className={activeTab === 'observations' ? 'active' : ''}
          onClick={() => setActiveTab('observations')}
        >
          Observations
        </button>
        <button
          className={activeTab === 'insights' ? 'active' : ''}
          onClick={() => setActiveTab('insights')}
        >
          Insights
        </button>
      </nav>

      {notice && <div className="notice">{notice}</div>}

      <main className="content">
        {loadingData && (
          <div className="loading-strip">Loading saved data…</div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <section className="hero-card">
              <p className="eyebrow light">WILDLIFE STUDY</p>
              <h2>Backyard + Lake</h2>
              <p>
                Record wildlife activity consistently, compare the two study
                environments, and watch patterns emerge over time.
              </p>
              <button
                className="light-button"
                onClick={() => setActiveTab('new')}
              >
                + Add Observation
              </button>
            </section>

            <section>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">AT A GLANCE</p>
                  <h2>Study Summary</h2>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard label="Total Observations" value={stats.total} />
                <StatCard label="Backyard" value={stats.backyard} />
                <StatCard label="Lake" value={stats.lake} />
                <StatCard label="Top Species" value={stats.topSpecies} />
                <StatCard label="Common Behavior" value={stats.topBehavior} />
                <StatCard label="Most Active Time" value={stats.topTime} />
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">RECENT DATA</p>
                  <h2>Latest Observations</h2>
                </div>
                {observations.length > 0 && (
                  <button
                    className="secondary-button"
                    onClick={() => setActiveTab('observations')}
                  >
                    View All
                  </button>
                )}
              </div>

              {observations.length === 0 ? (
                <EmptyState
                  title="No observations yet"
                  text="Add the first wildlife observation when you're ready."
                />
              ) : (
                <div className="record-list">
                  {observations.slice(0, 3).map((observation) => (
                    <ObservationCard
                      key={observation.id}
                      observation={observation}
                      compact
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'new' && (
          <section className="panel form-panel">
            <p className="eyebrow">DATA ENTRY</p>
            <h2>
              {editingObservationId
                ? 'Edit Observation'
                : 'New Wildlife Observation'}
            </h2>
            <p className="helper">
              Fields marked with * are required. The observation is not
              considered saved until the cloud confirms it.
            </p>

            <form onSubmit={saveObservation} className="form-grid">
              <label>
                Observation Date *
                <input
                  type="date"
                  value={observationForm.observation_date}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      observation_date: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Exact Time *
                <input
                  type="time"
                  value={observationForm.observation_time}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      observation_time: event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Time Category *
                <select
                  value={observationForm.time_category}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      time_category: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select…</option>
                  {TIME_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label>
                Location *
                <select
                  value={observationForm.location_type}
                  onChange={(event) => handleLocationChange(event.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  <option>Backyard</option>
                  <option>Lake</option>
                </select>
              </label>

              <label>
                Camera ID *
                <select
                  value={observationForm.camera_id}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      camera_id: event.target.value,
                    })
                  }
                  disabled={!observationForm.location_type}
                  required
                >
                  <option value="">Select…</option>

                  {observationForm.location_type === 'Backyard' && (
                    <option>B1</option>
                  )}

                  {observationForm.location_type === 'Lake' && (
                    <>
                      <option>L1</option>
                      <option>L2</option>
                    </>
                  )}
                </select>
              </label>

              <div className="full-width">
                <span className="field-label">Species Observed *</span>
                <p className="helper small">
                  Tap every species present in this observation.
                </p>

                <div className="chip-grid">
                  {SPECIES_OPTIONS.map((speciesName) => (
                    <button
                      key={speciesName}
                      type="button"
                      className={
                        observationForm.species.includes(speciesName)
                          ? 'chip selected'
                          : 'chip'
                      }
                      onClick={() => toggleSpecies(speciesName)}
                    >
                      {speciesName}
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Total Number of Animals *
                <select
                  value={observationForm.total_animals}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      total_animals: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select…</option>
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                  <option>4+</option>
                </select>
              </label>

              <label>
                Behavior *
                <select
                  value={observationForm.behavior}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      behavior: event.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select…</option>
                  {BEHAVIOR_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              {observationForm.behavior === 'Other' && (
                <label className="full-width">
                  Other Behavior
                  <input
                    type="text"
                    placeholder="Optional — describe the behavior"
                    value={observationForm.other_behavior}
                    onChange={(event) =>
                      setObservationForm({
                        ...observationForm,
                        other_behavior: event.target.value,
                      })
                    }
                  />
                </label>
              )}

              <label>
                Weather
                <select
                  value={observationForm.weather}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      weather: event.target.value,
                    })
                  }
                >
                  <option value="">Optional</option>
                  {WEATHER_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label>
                Temperature Range
                <select
                  value={observationForm.temperature_range}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      temperature_range: event.target.value,
                    })
                  }
                >
                  <option value="">Optional</option>
                  {TEMP_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="full-width">
                Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      photo: event.target.files?.[0] || null,
                    })
                  }
                />
                <span className="helper small">
                  Optional. A new photo replaces the existing photo when editing.
                </span>
              </label>

              <label className="full-width">
                Notes
                <textarea
                  rows="4"
                  placeholder="Optional observations, context, or anything unusual…"
                  value={observationForm.notes}
                  onChange={(event) =>
                    setObservationForm({
                      ...observationForm,
                      notes: event.target.value,
                    })
                  }
                />
              </label>

              <div className="form-actions full-width">
                {editingObservationId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setObservationForm(emptyObservation())
                      setEditingObservationId(null)
                    }}
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  className="primary-button"
                  type="submit"
                  disabled={savingObservation}
                >
                  {savingObservation
                    ? 'Saving to Cloud…'
                    : editingObservationId
                      ? 'Save Changes'
                      : 'Save Observation'}
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'observations' && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SAVED DATA</p>
                <h2>Observations</h2>
              </div>

              <button
                className="secondary-button"
                onClick={exportObservations}
                disabled={observations.length === 0}
              >
                Export CSV
              </button>
            </div>

            {observations.length === 0 ? (
              <EmptyState
                title="No observations yet"
                text="Saved observations will appear here."
              />
            ) : (
              <div className="record-list">
                {observations.map((observation) => (
                  <ObservationCard
                    key={observation.id}
                    observation={observation}
                    onEdit={() => beginEditObservation(observation)}
                    onDelete={() => deleteObservation(observation)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'insights' && (
          <>
            <section className="panel form-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">GUIDED REFLECTION</p>
                  <h2>{editingInsightId ? 'Edit Insight' : 'Add Insight'}</h2>
                </div>

                <button
                  className="secondary-button"
                  onClick={exportInsights}
                  disabled={insights.length === 0}
                >
                  Export Insights CSV
                </button>
              </div>

              <p className="helper">
                Only the entry date is required. Use whichever prompts are
                useful for the observations you're reviewing.
              </p>

              <form onSubmit={saveInsight} className="form-grid">
                <label>
                  Entry Date *
                  <input
                    type="date"
                    value={insightForm.entry_date}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        entry_date: event.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Observation Start Date
                  <input
                    type="date"
                    value={insightForm.observation_start_date}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        observation_start_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Observation End Date
                  <input
                    type="date"
                    value={insightForm.observation_end_date}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        observation_end_date: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Most Common Species
                  <input
                    type="text"
                    value={insightForm.most_common_species}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        most_common_species: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Most Active Time Category
                  <input
                    type="text"
                    placeholder="Dawn, day, dusk, night — or your own observation"
                    value={insightForm.most_active_time_category}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        most_active_time_category: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="full-width">
                  Backyard vs. Lake Differences
                  <textarea
                    rows="3"
                    value={insightForm.location_differences}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        location_differences: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="full-width">
                  Behavior Patterns
                  <textarea
                    rows="3"
                    value={insightForm.behavior_patterns}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        behavior_patterns: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="full-width">
                  Anything Unexpected?
                  <textarea
                    rows="3"
                    value={insightForm.unexpected_observations}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        unexpected_observations: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="full-width">
                  Summary / Conclusion
                  <textarea
                    rows="4"
                    value={insightForm.summary_conclusion}
                    onChange={(event) =>
                      setInsightForm({
                        ...insightForm,
                        summary_conclusion: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="form-actions full-width">
                  {editingInsightId && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setInsightForm(emptyInsight())
                        setEditingInsightId(null)
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={savingInsight}
                  >
                    {savingInsight
                      ? 'Saving to Cloud…'
                      : editingInsightId
                        ? 'Save Changes'
                        : 'Save Insight'}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <p className="eyebrow">REFLECTION HISTORY</p>
              <h2>Saved Insights</h2>

              {insights.length === 0 ? (
                <EmptyState
                  title="No insights yet"
                  text="Reflections will remain here with the research data."
                />
              ) : (
                <div className="record-list">
                  {insights.map((insight) => (
                    <article className="record-card" key={insight.id}>
                      <div className="record-top">
                        <div>
                          <strong>{formatDate(insight.entry_date)}</strong>
                          {(insight.observation_start_date ||
                            insight.observation_end_date) && (
                            <p className="record-meta">
                              Observation period:{' '}
                              {insight.observation_start_date
                                ? formatDate(insight.observation_start_date)
                                : '—'}{' '}
                              –{' '}
                              {insight.observation_end_date
                                ? formatDate(insight.observation_end_date)
                                : '—'}
                            </p>
                          )}
                        </div>

                        <div className="record-actions">
                          <button onClick={() => beginEditInsight(insight)}>
                            Edit
                          </button>
                          <button
                            className="danger-link"
                            onClick={() => deleteInsight(insight)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {insight.most_common_species && (
                        <InsightLine
                          label="Most common species"
                          value={insight.most_common_species}
                        />
                      )}
                      {insight.most_active_time_category && (
                        <InsightLine
                          label="Most active time"
                          value={insight.most_active_time_category}
                        />
                      )}
                      {insight.location_differences && (
                        <InsightLine
                          label="Backyard vs. lake"
                          value={insight.location_differences}
                        />
                      )}
                      {insight.behavior_patterns && (
                        <InsightLine
                          label="Behavior patterns"
                          value={insight.behavior_patterns}
                        />
                      )}
                      {insight.unexpected_observations && (
                        <InsightLine
                          label="Unexpected"
                          value={insight.unexpected_observations}
                        />
                      )}
                      {insight.summary_conclusion && (
                        <InsightLine
                          label="Summary"
                          value={insight.summary_conclusion}
                        />
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="app-footer">
        Wildlife Tracker • Cloud-saved field observations
      </footer>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function ObservationCard({
  observation,
  onEdit,
  onDelete,
  compact = false,
}) {
  return (
    <article className="record-card">
      <div className="record-top">
        <div>
          <div className="species-title">
            {(observation.species || []).join(' + ') || 'Wildlife'}
          </div>
          <p className="record-meta">
            {formatDate(observation.observation_date)} •{' '}
            {formatTime(observation.observation_time)} •{' '}
            {observation.time_category}
          </p>
        </div>

        {!compact && (
          <div className="record-actions">
            <button onClick={onEdit}>Edit</button>
            <button className="danger-link" onClick={onDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="tag-row">
        <span>{observation.location_type}</span>
        <span>{observation.camera_id}</span>
        <span>
          {observation.total_animals}{' '}
          {observation.total_animals === '1' ? 'animal' : 'animals'}
        </span>
        <span>
          {observation.behavior === 'Other' && observation.other_behavior
            ? observation.other_behavior
            : observation.behavior}
        </span>
      </div>

      {!compact && (
        <>
          {(observation.weather || observation.temperature_range) && (
            <p className="record-detail">
              {[observation.weather, observation.temperature_range]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}

          {observation.notes && (
            <p className="record-notes">{observation.notes}</p>
          )}

          {observation.photo_path && (
            <button
              type="button"
              className="photo-saved"
              onClick={async () => {
                const { data, error } = await supabase.storage
                  .from('wildlife-photos')
                  .createSignedUrl(observation.photo_path, 60)

                if (error) {
                  window.alert(`Could not open photo. ${error.message}`)
                  return
                }

                window.open(
                  data.signedUrl,
                  '_blank',
                  'noopener,noreferrer'
                )
              }}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📷 View Photo
            </button>
          )}
        </>
      )}
    </article>
  )
}

function InsightLine({ label, value }) {
  return (
    <div className="insight-line">
      <strong>{label}</strong>
      <p>{value}</p>
    </div>
  )
}

function formatDate(date) {
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString()
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const date = new Date()
  date.setHours(Number(hours), Number(minutes), 0, 0)

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default App