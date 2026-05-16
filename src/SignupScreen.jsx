import { useState } from "react";

function SignupScreen({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  function handleSignup(event) {
    event.preventDefault();
    setStatus("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) {
      setStatus("Please enter both an email and a password.");
      return;
    }
    localStorage.setItem(
      "goldenhours-user",
      JSON.stringify({ email: cleanEmail, password: cleanPassword })
    );
    onSuccess();
  }

  return (
    <section className="planner-view" aria-labelledby="signup-title">
      <div className="section-heading">
        <p className="eyebrow">Signup</p>
        <h1 id="signup-title">Create Account</h1>
      </div>
      <form className="planner-form" onSubmit={handleSignup}>
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
        />
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />
        {status && (
          <p className="form-status" role="status">
            {status}
          </p>
        )}
        <button className="primary-action wide" type="submit">
          Sign Up
        </button>
      </form>
    </section>
  );
}

export default SignupScreen;