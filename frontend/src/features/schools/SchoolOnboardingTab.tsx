import { ChangeEvent, useEffect, useState } from 'react';
import { PhaseTaskStatus } from '@b2b-ops/shared';
import { api, OnboardingOverview, schoolAssetUrl } from '../../lib/api';
import { makeCobrandedLogo, resizeImageFile, whatsappNumber } from '../../lib/logo-image';

// SOP Phase 4 — Onboarding Setup, in the order it's done. WhatsApp can't be
// driven from here (no API creates groups or adds people), so each step does
// the work around it — invites, logo, co-branded logo, welcome message —
// and what it records ticks the checklist automatically.
export function SchoolOnboardingTab({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<OnboardingOverview | null>(null);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reload() {
    return api
      .getOnboarding(schoolId)
      .then((d) => {
        setData(d);
        setLink((l) => l || d.whatsappGroupLink || '');
        setMessage((m) => m || d.welcomeMessage);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const done = (key: string) => data.tasks[key]?.status === PhaseTaskStatus.DONE;
  const inviteText = `Hello! Please join the official ${data.schoolName} × codevidhya WhatsApp group: ${data.whatsappGroupLink ?? ''}`;
  const cobrandedUrl = data.cobrandedLogoUpdatedAt ? schoolAssetUrl(schoolId, 'COBRANDED_LOGO', data.cobrandedLogoUpdatedAt) : null;
  const logoUrl = data.logoUpdatedAt ? schoolAssetUrl(schoolId, 'LOGO', data.logoUpdatedAt) : null;
  const cobrandedFileName = `${data.schoolName.replace(/[^\w]+/g, '-')}-x-codevidhya.png`;

  const saveLink = () =>
    run('link', async () => {
      const result = await api.setWhatsappLink(schoolId, link);
      if (result.inviteSent === true) return `Link saved, and the invite was emailed to ${data.ownerEmail}.`;
      if (result.inviteSent === false) return 'Link saved. The invite email to the owner wasn’t sent — check the owner email (Edit school), then Activity → Emails.';
      return 'Link saved.';
    });

  const inviteTeacher = (teacherId: string, phone: string) => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener');
    run(`teacher-${teacherId}`, async () => {
      await api.markTeacherWhatsappInvited(schoolId, teacherId);
    });
  };

  const uploadLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run('logo', async () => {
      const logo = await resizeImageFile(file);
      await api.uploadSchoolAsset(schoolId, 'LOGO', logo);
      await api.uploadSchoolAsset(schoolId, 'COBRANDED_LOGO', await makeCobrandedLogo(logo, data.schoolName));
      return 'Logo saved, and the co-branded partnership logo was made from it.';
    });
  };

  const remakeCobranded = () =>
    run('cobranded', async () => {
      if (!logoUrl) return;
      await api.uploadSchoolAsset(schoolId, 'COBRANDED_LOGO', await makeCobrandedLogo(logoUrl, data.schoolName));
      return 'Co-branded logo made again.';
    });

  // Phones share the logo + message together through the share sheet;
  // computers download the logo and open WhatsApp with the message typed in.
  const shareWelcome = () =>
    run('share', async () => {
      let file: File | null = null;
      if (cobrandedUrl) {
        const blob = await (await fetch(cobrandedUrl, { credentials: 'include' })).blob();
        file = new File([blob], cobrandedFileName, { type: blob.type });
      }
      const native = !!file && !!navigator.canShare?.({ files: [file], text: message });
      if (native && file) {
        try {
          await navigator.share({ files: [file], text: message });
        } catch {
          return; // share sheet closed without sharing — nothing to tick
        }
      } else {
        if (cobrandedUrl) {
          const a = document.createElement('a');
          a.href = cobrandedUrl;
          a.download = cobrandedFileName;
          a.click();
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      }
      await api.markWelcomeShared(schoolId);
      return !native && cobrandedUrl
        ? 'WhatsApp opened with the message. The co-branded logo was downloaded — attach it in the group chat.'
        : 'Marked as shared on WhatsApp.';
    });

  const Step = ({ n, title, taskKeys }: { n: number; title: string; taskKeys: string[] }) => (
    <div className="onboarding-step-head">
      <h3>
        <span className="onboarding-step-num">{n}</span>
        {title}
      </h3>
      {taskKeys.every(done) ? <span className="badge badge-success">✓ Done</span> : <span className="badge badge-warning">To do</span>}
    </div>
  );

  return (
    <div className="onboarding-tab">
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <div className="card">
        <Step n={1} title="WhatsApp group" taskKeys={['whatsapp_group_created']} />
        <p className="muted small">
          Create the group in WhatsApp, then open <strong>Group info → Invite via link → Copy link</strong> and paste it here.
          Saving it emails the invite to the school owner.
        </p>
        <div className="onboarding-inline">
          <input placeholder="https://chat.whatsapp.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button onClick={saveLink} disabled={busy === 'link' || !link.trim()}>
            {busy === 'link' ? 'Saving…' : 'Save link'}
          </button>
        </div>
      </div>

      <div className="card">
        <Step n={2} title="Invite key people" taskKeys={['whatsapp_stakeholders_added']} />
        {!data.whatsappGroupLink ? (
          <p className="muted small">Save the group link first.</p>
        ) : (
          <>
            <div className="onboarding-person">
              <div>
                <strong>{data.ownerName ?? 'School owner'}</strong> <span className="muted small">Owner / Principal</span>
                <div className="muted small">
                  {data.ownerInvite
                    ? `✓ Invite emailed ${new Date(data.ownerInvite.sentAt).toLocaleDateString('en-IN')}`
                    : data.ownerEmail
                      ? 'Invite not emailed yet'
                      : 'No owner email — add it in Edit school'}
                </div>
              </div>
              <button className="secondary" onClick={() => run('owner', async () => ((await api.emailWhatsappInvite(schoolId)).sent ? 'Invite emailed to the owner.' : 'The email wasn’t sent — see Activity → Emails.'))} disabled={!data.ownerEmail || busy === 'owner'}>
                {data.ownerInvite ? 'Email again' : 'Email invite'}
              </button>
            </div>
            {data.teachers.length === 0 && (
              <p className="muted small">No teachers yet — they appear here once the school fills in the teacher details form.</p>
            )}
            {data.teachers.map((t) => {
              const phone = whatsappNumber(t.phone);
              return (
                <div key={t.id} className="onboarding-person">
                  <div>
                    <strong>{t.name}</strong> {t.designation && <span className="muted small">{t.designation}</span>}
                    <div className="muted small">
                      {t.whatsappInvitedAt ? `✓ Invited ${new Date(t.whatsappInvitedAt).toLocaleDateString('en-IN')}` : phone ? t.phone : 'No phone number'}
                    </div>
                  </div>
                  <button className="secondary" onClick={() => phone && inviteTeacher(t.id, phone)} disabled={!phone || busy === `teacher-${t.id}`}>
                    {t.whatsappInvitedAt ? 'Invite again' : 'Invite on WhatsApp'}
                  </button>
                </div>
              );
            })}
            <p className="muted small">Ticks itself once the owner’s invite is emailed and at least one teacher (the computer teacher) is invited.</p>
          </>
        )}
      </div>

      <div className="card">
        <Step n={3} title="School logo" taskKeys={['school_logo_collected']} />
        <div className="onboarding-logo-row">
          <div className="onboarding-logo-box">{logoUrl ? <img src={logoUrl} alt={`${data.schoolName} logo`} /> : <span className="muted small">No logo yet</span>}</div>
          <div>
            <label className="button-like secondary">
              {busy === 'logo' ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={busy === 'logo'} hidden />
            </label>
            <p className="muted small">The school can also upload it themselves on the teacher details form.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <Step n={4} title="Co-branded partnership logo" taskKeys={['cobranded_logo_designed']} />
        {cobrandedUrl ? (
          <>
            <img className="onboarding-cobranded" src={cobrandedUrl} alt="Co-branded partnership logo" />
            <div className="button-row">
              <a href={cobrandedUrl} download={cobrandedFileName}>
                <button type="button" className="secondary">Download</button>
              </a>
              <button className="secondary" onClick={remakeCobranded} disabled={busy === 'cobranded'}>
                {busy === 'cobranded' ? 'Making…' : 'Make again'}
              </button>
            </div>
          </>
        ) : (
          <p className="muted small">Made automatically as soon as the school logo is uploaded.</p>
        )}
      </div>

      <div className="card">
        <Step n={5} title="Welcome message on WhatsApp" taskKeys={['welcome_message_shared']} />
        <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="button-row">
          <button onClick={shareWelcome} disabled={busy === 'share' || !message.trim()}>
            {busy === 'share' ? 'Opening…' : 'Share on WhatsApp'}
          </button>
          <button className="secondary" onClick={() => setMessage(data.welcomeMessage)}>
            Reset message
          </button>
        </div>
        <p className="muted small">On a phone, the message and co-branded logo go together. On a computer, the logo downloads — attach it in the group chat.</p>
      </div>
    </div>
  );
}
