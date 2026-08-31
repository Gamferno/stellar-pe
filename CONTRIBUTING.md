# Contributing to StellarPe

Thank you for your interest in contributing to **StellarPe**! We welcome contributions from developers, designers, and documentation writers across the Stellar ecosystem.

---

## Code of Conduct

Please be respectful, collaborative, and inclusive. Treat all community members with kindness.

---

## Development Workflow

1. **Fork the repository** on GitHub: [github.com/Gamferno/stellar-pay](https://github.com/Gamferno/stellar-pay).
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/stellar-pay.git
   cd stellar-pay
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Smart Contract Development**:
   ```bash
   cd contracts/settlement
   cargo test
   cargo build --release
   ```
5. **Backend Development**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
6. **Frontend Development**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
7. **Commit your changes**:
   ```bash
   git commit -m "feat: descriptive summary of changes"
   ```
8. **Push to your fork and open a Pull Request**.

---

## Pull Request Guidelines

- Ensure all Soroban tests pass (`cargo test`).
- Ensure frontend builds cleanly (`npm run build` in `frontend`).
- Follow clear, conventional commit messages.
