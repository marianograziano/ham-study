sed -i '' -e 's/println!("tbf: ix={}, njun1={}, njun2={}, jsno={}", ix, njun1, njun2, ctx.segj.jsno);/println!("tbf: ix={}, njun1={}, njun2={}, jsno={}", ix, njun1, njun2, ctx.segj.jsno);/g' src/nec/physics.rs
sed -i '' -e '/loop_idx += 1;/i\
        println!("Phase1 iter loop_idx={}, jcox={}", loop_idx, jcox);' src/nec/physics.rs
cargo test --test current_distribution_tests -- --nocapture | head -n 30
