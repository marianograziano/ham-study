#!/bin/bash
cargo test --test current_distribution_tests -- --nocapture | grep -A 5 "A\[0,0\]"
