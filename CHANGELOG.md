# Changelog

All notable changes to the **StellarPe** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-31

### Added
- **Soroban Settlement Contract:** Deployed on Stellar Testnet (`CCCEJOC6FP2GV2MFSAZF7LNECT7QZ3BRYMZQ5OBEH3SOJWIVJN5T7ALS`) with `initialize`, `record_payment`, `get_merchant_balance`, and `mark_settled` functions.
- **Soroban Unit Tests:** 7/7 passing unit tests with 100% code coverage in `contracts/settlement/src/test.rs`.
- **Dynamic QR Code Generator:** SEP-7 URI payment generation and standard Stellar address mode in `frontend/src/components/QRGenerator.jsx`.
- **Anchor Off-Ramp Engine:** SEP-38 real-time FX quote and SEP-24 interactive withdrawal pipeline in `frontend/src/components/SettleButton.jsx` and `backend/src/routes/withdraw.sep24.js`.
- **Event Listener Service:** Real-time Stellar Horizon/RPC polling subscriber in `backend/src/services/stellarEventListener.js`.
- **In-App Rating & Feedback Engine:** 5-star customer experience survey with comments in `frontend/src/components/FeedbackForm.jsx`.
- **1080p Full HD Video Suite:** 5 dedicated interactive utility showcase videos in `docs/video/` and master 60s demo.
- **Verified User Testing Suite:** 52 verified testnet user interactions recorded in `users.csv` and `docs/user_proofs.json`.
- **Interactive Pitch Deck:** 9-slide HTML presentation deck in `docs/pitch-deck.html` and guide in `docs/pitch-deck.md`.
- **Security Audit Report:** Comprehensive self-audit in `docs/security-audit.md`.
- **Technical Ecosystem Tutorial:** Complete guide in `docs/blog-stellarpe-tutorial.md`.
- **Automated CI/CD:** Multi-stage GitHub Actions workflow in `.github/workflows/ci.yml`.
