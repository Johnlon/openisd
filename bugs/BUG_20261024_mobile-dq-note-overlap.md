# BUG_20261024_mobile-dq-note-overlap

Status: FIXED

On the phone Box tab, opening a field's DQ warning showed the explanation behind the
following field. Classic phone rows were fixed at 40 px even when the shared UI field
rendered its explanation as a second grid row.

The field now advertises its open-note state and the classic mobile row grows to contain
the explanation. The mobile Box browser test asserts that the note ends before the next
field begins.
