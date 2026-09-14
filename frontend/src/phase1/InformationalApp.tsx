import { displayCapabilityState, displayState, policy } from './policy';
import './informational.css';

export default function InformationalApp() {
  const location = `${policy.planning.city}, ${policy.planning.country_name ?? policy.planning.country_code}`;

  return (
    <div className="kaya-information">
      <header className="kaya-information__header">
        <span className="kaya-information__brand" aria-label="KAYA">KAYA<span aria-hidden="true">.</span></span>
        <span className="kaya-information__badge">Information only</span>
      </header>
      <main>
        <section className="kaya-information__intro" aria-labelledby="planning-title">
          <p className="kaya-information__eyebrow">A considered start</p>
          <h1 id="planning-title">{policy.public_copy.title}</h1>
          <p className="kaya-information__lead">
            {policy.public_copy.planning_notice}
          </p>
          <div className="kaya-information__notice" role="note">
            <strong>{policy.public_copy.availability}</strong>
            <p>Do not send personal or health information.</p>
          </div>
        </section>

        <section className="kaya-information__facts" aria-label="Planning and access status">
          <div>
            <h2>Planning location</h2>
            <p>{location}</p>
            <span>Scope: {displayState(policy.planning.approval_scope)}.</span>
          </div>
          <div>
            <h2>Release status</h2>
            <p>{displayState(policy.release.status)}</p>
            <span>{policy.release.approved_jurisdictions.length === 0
              ? 'No jurisdiction is approved for service access.'
              : 'This version remains information only.'}</span>
          </div>
          <div>
            <h2>Your jurisdiction</h2>
            <p>Unverified</p>
            <span>Language and device settings do not establish eligibility.</span>
          </div>
        </section>

        <section className="kaya-information__capabilities" aria-labelledby="capabilities-title">
          <div className="kaya-information__section-heading">
            <p className="kaya-information__eyebrow">Current capability status</p>
            <h2 id="capabilities-title">What is available today</h2>
            <p>The states below describe the current project. They do not authorize care or participation.</p>
          </div>
          <div className="kaya-information__table-scroll">
            <table>
              <caption className="kaya-information__sr-only">KAYA capability states and public availability</caption>
              <thead><tr><th scope="col">Capability</th><th scope="col">Current state</th><th scope="col">Public access</th></tr></thead>
              <tbody>
                {policy.capabilities.map(capability => (
                  <tr key={capability.id}>
                    <th scope="row">{capability.label}</th>
                    <td>{displayCapabilityState(capability.state)}</td>
                    <td><span className="kaya-information__unavailable">Unavailable in this version</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <footer className="kaya-information__footer">
        <span>KAYA · {location}</span>
        <span>Planning approval does not authorize launch.</span>
      </footer>
    </div>
  );
}
