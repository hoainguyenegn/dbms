import { useEffect, useState } from 'react'
import '../App.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '')

const services = [
  {
    key: 'api',
    name: 'Node.js API',
    icon: 'server',
    description: 'Tiếp nhận yêu cầu và kết nối các thành phần của hệ thống.',
    detail: 'Express · REST API',
  },
  {
    key: 'mysql',
    name: 'MySQL',
    icon: 'database',
    description: 'Nơi lưu dữ liệu chính của ứng dụng khi bắt đầu xây dựng nghiệp vụ.',
    detail: 'Cơ sở dữ liệu quan hệ',
  },
  {
    key: 'redis',
    name: 'Redis',
    icon: 'layers',
    description: 'Chuẩn bị cache thông tin giữ vé; MySQL là nguồn dữ liệu chính.',
    detail: 'Bộ nhớ key–value',
  },
]

const statusLabels = {
  up: 'Đã kết nối',
  down: 'Mất kết nối',
  checking: 'Đang kiểm tra',
  unknown: 'Chưa xác nhận',
}

const initialResult = {
  phase: 'loading',
  health: null,
  error: '',
  checkedAt: null,
}

function Icon({ name, className = '' }) {
  const paths = {
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M9 5v3m0 3v2m0 3v3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    server: <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6m-6 11h6" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    layers: <><path d="m12 3 10 5-10 5L2 8Zm-9 10 9 5 9-5M3 18l9 5 9-5" /></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  }

  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Command({ step, title, command }) {
  const [copyStatus, setCopyStatus] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopyStatus('Đã sao chép')
    } catch {
      setCopyStatus('Không thể sao chép. Hãy chọn lệnh bên dưới.')
    }
  }

  return (
    <div className="command-step">
      <div className="command-title"><span>{step}</span><h3>{title}</h3></div>
      <div className="command-line"><code>{command}</code><button onClick={copy} aria-label={`Sao chép lệnh ${title}`} title={`Sao chép lệnh ${title}`}><Icon name={copyStatus === 'Đã sao chép' ? 'check' : 'copy'} /></button></div>
      <span className="copy-feedback" role="status">{copyStatus}</span>
    </div>
  )
}

export default function SystemStatus() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(initialResult)
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 8000)

    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })

        if (response.status !== 200 && response.status !== 503) {
          throw new Error(`API trả về mã HTTP ${response.status}.`)
        }

        const health = await response.json()
        const validServices = services.every(
          ({ key }) => ['up', 'down'].includes(health?.services?.[key]),
        )
        const allUp = services.every(
          ({ key }) => health?.services?.[key] === 'up',
        )

        if (
          !validServices ||
          health.status !== (allUp ? 'healthy' : 'degraded') ||
          response.status !== (allUp ? 200 : 503)
        ) {
          throw new Error('API trả về dữ liệu trạng thái không hợp lệ.')
        }

        if (active) {
          setResult({
            phase: 'ready',
            health,
            error: '',
            checkedAt: new Date(),
          })
        }
      } catch (error) {
        if (active) {
          const message = controller.signal.aborted
            ? 'API chưa phản hồi sau 8 giây.'
            : error instanceof TypeError
              ? 'Không kết nối được tới API. Kiểm tra backend và cấu hình CORS.'
              : error instanceof SyntaxError
                ? 'API chưa trả về dữ liệu JSON hợp lệ.'
                : error.message

          setResult({
            phase: 'error',
            health: null,
            error: message,
            checkedAt: new Date(),
          })
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    checkHealth()

    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt])

  function refresh() {
    setResult(initialResult)
    setAttempt((value) => value + 1)
  }

  const loading = result.phase === 'loading'
  const onlineCount = services.filter(
    ({ key }) => result.health?.services[key] === 'up',
  ).length
  const overall = loading
    ? 'checking'
    : result.phase === 'error'
      ? 'unknown'
      : result.health.status === 'healthy'
        ? 'up'
        : 'down'
  const summary = {
    checking: 'Đang kiểm tra hệ thống',
    up: 'Hệ thống sẵn sàng',
    down: 'Có dịch vụ chưa sẵn sàng',
    unknown: 'Chưa lấy được trạng thái',
  }[overall]

  return (
    <div className="system-page app-shell">
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveSection('overview')} aria-label="Event Ticketing — Tổng quan">
          <span className="brand-mark"><Icon name="ticket" /></span>
          <span>Event Ticketing<small>DEVELOPER WORKSPACE</small></span>
        </a>
        <div className="workspace-label"><span className="workspace-avatar">D</span><div>Đồ án DBMS<small>Môi trường phát triển</small></div><span className="workspace-dot" /></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Điều hướng chính">
          {[
            { id: 'overview', icon: 'grid', label: 'Tổng quan' },
            { id: 'connections', icon: 'server', label: 'Dịch vụ & kết nối' },
            { id: 'quickstart', icon: 'terminal', label: 'Khởi động nhanh' },
          ].map((item) => (
            <a key={item.id} className={activeSection === item.id ? 'nav-link active' : 'nav-link'} href={`#${item.id}`} onClick={() => setActiveSection(item.id)} aria-current={activeSection === item.id ? 'location' : undefined}>
              <Icon name={item.icon} />{item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="development-note"><Icon name="code" /><h2>Bắt đầu từ nền tảng.</h2><p>Kết nối các dịch vụ, sau đó cùng nhau xây dựng trải nghiệm đặt vé.</p><a href="#quickstart" onClick={() => setActiveSection('quickstart')}>Xem cách khởi động <Icon name="arrow" /></a></div>
          <div className="sidebar-footer"><span className="workspace-avatar">ET</span><div>Event Ticketing<small>React + Node.js</small></div><span className="version-label">DEV</span></div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="breadcrumb"><a href="/">← Trang chủ</a> <span>/</span> <strong>Tổng quan hệ thống</strong></div><span className="environment-tag"><span />Local development</span></header>
        <main id="main-content">
          <section className="page-heading" id="overview" aria-labelledby="page-title">
            <div><p className="eyebrow">SẴN SÀNG ĐỂ XÂY DỰNG</p><h1 id="page-title">Tổng quan hệ thống<span>.</span></h1><p>Không gian làm việc nhỏ. Nền tảng cho những sự kiện lớn.</p></div>
            <button className="refresh-button" onClick={refresh} disabled={loading}><Icon name="refresh" className={loading ? 'spinning' : ''} />{loading ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</button>
          </section>

          <section className={`health-banner health-${overall}`} aria-label="Trạng thái hệ thống">
            <div className="health-summary"><div className="health-symbol">{overall === 'up' ? <Icon name="check" /> : <Icon name={loading ? 'refresh' : 'server'} className={loading ? 'spinning' : ''} />}</div><div><h2 role="status" aria-live="polite">{summary}</h2><p>{result.phase === 'ready' ? `${onlineCount}/3 dịch vụ đã kết nối. ${overall === 'up' ? 'Bạn có thể tiếp tục phát triển dự án.' : 'Kiểm tra dịch vụ đang mất kết nối bên dưới.'}` : loading ? 'Đang kiểm tra API, MySQL và Redis…' : 'Chưa có kết quả xác nhận. Kiểm tra backend rồi thử lại.'}</p></div></div>
            <div className="health-meter" aria-label={result.phase === 'ready' ? `${onlineCount} trên 3 dịch vụ đã kết nối` : 'Chưa có kết quả'}>
              <div><strong>{result.phase === 'ready' ? String(onlineCount).padStart(2, '0') : '—'}</strong><span>/ 03 dịch vụ</span></div>
              <div className="meter-bars" aria-hidden="true">{services.map(({ key }) => <span key={key} className={`meter-${result.health?.services[key] || 'unknown'}`} />)}</div>
            </div>
          </section>

          {result.error && <div className="error-message" role="alert"><strong>Không thể hoàn tất kiểm tra.</strong><span>{result.error}</span></div>}

          <section id="connections" aria-labelledby="connections-title">
            <div className="section-heading"><h2 id="connections-title">Dịch vụ & kết nối <span>03</span></h2><span className="section-hint">Trạng thái từ API /health</span></div>
            <div className="service-grid" aria-busy={loading}>
              {services.map((service, index) => {
                const status = loading ? 'checking' : result.health?.services[service.key] || 'unknown'
                return (
                  <article className="service-card" key={service.key}>
                    <div className="service-topline"><span className={`service-mark mark-${service.key}`}><Icon name={service.icon} /></span><span className="service-index">0{index + 1}</span></div>
                    <h3>{service.name}</h3><p className="service-detail">{service.detail}</p><p className="service-description">{service.description}</p>
                    <div className="service-bottom"><span className={`status-label status-${status}`}><span className="status-dot" />{statusLabels[status]}</span><span className="service-runtime">{service.key === 'api' ? 'API' : 'DATABASE'}</span></div>
                  </article>
                )
              })}
            </div>
            <div className="connection-meta"><span><Icon name="clock" />{result.checkedAt ? `Kiểm tra lúc ${result.checkedAt.toLocaleTimeString('vi-VN')}` : 'Đang chờ kết quả'}</span><span>Cập nhật khi bạn bấm kiểm tra lại</span></div>
          </section>

          <div className="details-grid">
            <section className="panel architecture-panel" aria-labelledby="architecture-title">
              <div className="panel-heading"><span className="panel-icon"><Icon name="layers" /></span><div><h2 id="architecture-title">Một hệ thống. Bốn thành phần.</h2><p>Luồng kết nối trong kiến trúc hiện tại</p></div></div>
              <div className="architecture-flow" aria-label="React gọi Node.js qua HTTP. Node.js kết nối tới MySQL và Redis.">
                <div className="flow-node"><span className="flow-icon react-icon"><Icon name="code" /></span><strong>React</strong><small>Giao diện</small></div>
                <div className="flow-arrow"><span>HTTP</span><Icon name="arrow" /></div>
                <div className="flow-node"><span className="flow-icon node-icon"><Icon name="server" /></span><strong>Node.js</strong><small>Backend</small></div>
                <div className="flow-arrow"><Icon name="arrow" /></div>
                <div className="flow-databases"><div><Icon name="database" /><span>MySQL</span></div><div><Icon name="layers" /><span>Redis</span></div></div>
              </div>
              <p className="architecture-note"><span />Chỉ backend kết nối trực tiếp đến database.</p>
              <div className="endpoint-row"><span className="http-method">GET</span><a href={`${API_URL}/health`} target="_blank" rel="noreferrer">{API_URL}/health</a><Icon name="arrow" /></div>
              <details className="response-details"><summary>Xem phản hồi JSON <Icon name="code" /></summary><pre>{result.health ? JSON.stringify(result.health, null, 2) : loading ? '// Đang chờ phản hồi từ API…' : '// Chưa có phản hồi hợp lệ. Hãy kiểm tra lại kết nối.'}</pre></details>
            </section>

            <section className="panel quickstart-panel" id="quickstart" aria-labelledby="quickstart-title">
              <div className="panel-heading"><span className="panel-icon"><Icon name="terminal" /></span><div><h2 id="quickstart-title">Khởi động nhanh</h2><p>Chạy tại thư mục gốc DBMS</p></div></div>
              <Command step="1" title="Kiểm tra MySQL · dùng tài khoản trong .env" command="mysql --protocol=TCP -h 127.0.0.1 -P 3306 -u event_ticketing -p event_ticketing" />
              <Command step="2" title="Kiểm tra Redis local" command="redis-cli -h 127.0.0.1 -p 6379 PING" />
              <Command step="3" title="Chạy backend · terminal riêng" command="npm --prefix backend run dev" />
              <Command step="4" title="Chạy frontend · terminal riêng" command="npm --prefix frontend run dev" />
              <p className="quickstart-note">Khởi động MySQL/Redis trực tiếp trên máy theo <strong>README.md</strong>. Các lệnh kiểm tra dùng host, port và tài khoản mẫu; thay bằng cấu hình của bạn nếu đã đổi. Chuẩn bị <code>.env</code> và dependencies trước khi chạy.</p>
            </section>
          </div>
          <footer className="site-footer"><span><Icon name="ticket" />Event Ticketing <span className="footer-divider">/</span> Đồ án DBMS</span><span>Giai đoạn skeleton · Chưa có chức năng đặt vé</span></footer>
        </main>
      </div>
    </div>
  )
}
