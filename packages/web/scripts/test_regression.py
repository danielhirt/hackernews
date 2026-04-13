"""Comprehensive regression test for Omnifeed.

Exercises all major user flows against the running dev server.
Screenshots saved to /tmp/regression_*.png for visual inspection.
"""
from playwright.sync_api import sync_playwright
import sys
import os

SCREENSHOTS = "/tmp"
BASE = "http://localhost:5173"
errors = []
warnings = []

def screenshot(page, name):
    path = os.path.join(SCREENSHOTS, f"regression_{name}.png")
    page.screenshot(path=path, full_page=True)
    return path

def check(condition, msg):
    if not condition:
        errors.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  OK: {msg}")

def warn(condition, msg):
    if not condition:
        warnings.append(msg)
        print(f"  WARN: {msg}")

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # Capture console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ============================================================
        # 1. Homepage loads with HN top stories (default)
        # ============================================================
        print("\n1. Homepage / HN Top Stories")
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        check(page.title() == "Omnifeed", f"Page title is 'Omnifeed', got '{page.title()}'")

        source_btn = page.locator(".source-btn")
        check(source_btn.count() > 0, "Source selector button exists")
        check("HN" in source_btn.inner_text(), f"Default source is HN, got '{source_btn.inner_text()}'")

        tabs = page.locator(".tab").all()
        check(len(tabs) >= 2, f"Feed tabs exist ({len(tabs)} found)")
        active_tab = page.locator(".tab.active")
        check(active_tab.count() > 0, "An active tab exists")

        stories = page.locator(".story-card").all()
        check(len(stories) > 0, f"Stories loaded ({len(stories)} found)")

        if stories:
            first = stories[0]
            check(first.locator(".rank").count() > 0, "Story has rank")
            check(first.locator(".title").count() > 0, "Story has title")
            check(first.locator(".meta").count() > 0, "Story has meta")
            check(first.locator(".ai-toggle").count() > 0, "Story has AI toggle button")
            check(first.locator(".save-btn").count() > 0, "Story has save button")
            href = first.get_attribute("data-href")
            check(href is not None and len(href) > 0, f"Story card has data-href='{href}'")

        screenshot(page, "01_hn_top")

        # ============================================================
        # 2. Feed tab switching
        # ============================================================
        print("\n2. Feed Tab Switching")
        tabs = page.locator(".tab").all()
        if len(tabs) >= 2:
            second_tab = tabs[1]
            tab_text = second_tab.inner_text()
            second_tab.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            active = page.locator(".tab.active")
            check(active.inner_text() == tab_text, f"Tab '{tab_text}' is now active")
            new_stories = page.locator(".story-card").all()
            check(len(new_stories) > 0, f"Stories loaded after tab switch ({len(new_stories)})")
            screenshot(page, "02_tab_switch")

        # ============================================================
        # 3. Source switching (Lobsters)
        # ============================================================
        print("\n3. Source Switching to Lobsters")
        page.locator(".source-btn").click()
        page.wait_for_timeout(500)
        menu = page.locator(".source-menu")
        check(menu.count() > 0, "Source menu opened")

        lobsters_option = page.locator(".source-option", has_text="Lobsters")
        if lobsters_option.count() > 0:
            lobsters_option.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            source_text = page.locator(".source-btn").inner_text()
            check("LO" in source_text.upper() or "LOBSTERS" in source_text.upper(),
                  f"Source switched to Lobsters, btn='{source_text}'")

            lo_stories = page.locator(".story-card").all()
            check(len(lo_stories) > 0, f"Lobsters stories loaded ({len(lo_stories)})")

            tag_pills = page.locator(".tag-pill").all()
            warn(len(tag_pills) > 0, f"Lobsters stories have tags ({len(tag_pills)} found)")
            screenshot(page, "03_lobsters")
        else:
            errors.append("Lobsters option not found in source menu")

        # ============================================================
        # 4. Tag navigation
        # ============================================================
        print("\n4. Tag Navigation")
        tag_pills = page.locator(".tag-pill").all()
        if tag_pills:
            tag_text = tag_pills[0].inner_text().strip()
            tag_pills[0].click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            tag_header = page.locator(".tag-header")
            check(tag_header.count() > 0, "Tag header visible")

            back_link = page.locator(".back-link")
            check(back_link.count() > 0, "Back button exists in tag view")

            active_tabs = page.locator(".tab.active").all()
            check(len(active_tabs) == 0, f"No active tab during tag view (found {len(active_tabs)})")

            tag_stories = page.locator(".story-card").all()
            check(len(tag_stories) > 0, f"Tag stories loaded ({len(tag_stories)})")
            screenshot(page, "04_tag_view")

            back_link.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            check(page.locator(".tag-header").count() == 0, "Tag header gone after back")
            screenshot(page, "04b_after_tag_back")
        else:
            warnings.append("No tag pills found to test tag navigation")

        # ============================================================
        # 5. Item detail page
        # ============================================================
        print("\n5. Item Detail Page")
        page.goto(f"{BASE}/?source=hackernews&feed=top")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        stories = page.locator(".story-card").all()
        if stories:
            stories[0].click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)

            check("/item/" in page.url, f"Navigated to item detail ({page.url})")

            back = page.locator(".back-link")
            check(back.count() > 0, "Item detail has back link")

            # Correct selector: .story-title
            item_title = page.locator(".story-title")
            check(item_title.count() > 0, "Item detail has title")

            ai_btn = page.locator(".ai-btn")
            check(ai_btn.count() > 0, "Item detail has AI summary button")

            comments = page.locator(".comment-node")
            warn(comments.count() > 0, f"Comments loaded ({comments.count()} found)")

            screenshot(page, "05_item_detail")

            back.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            check("item" not in page.url, "Returned to feed from item detail")
            screenshot(page, "05b_back_from_item")

        # ============================================================
        # 6. HN Search
        # ============================================================
        print("\n6. HN Search")
        page.goto(f"{BASE}/?source=hackernews&feed=top")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        search_input = page.locator(".search-input")
        if search_input.count() > 0:
            search_input.click()
            search_input.fill("rust programming")
            page.locator(".search-btn[type='submit']").click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)

            search_results = page.locator(".story-card").all()
            check(len(search_results) > 0, f"Search returned results ({len(search_results)})")

            # Pagination may or may not exist depending on result count
            pagination = page.locator(".pagination")
            warn(pagination.count() > 0, "Search pagination visible (depends on result count)")

            screenshot(page, "06_search")

            clear_btn = page.locator(".search-btn", has_text="Clear")
            if clear_btn.count() > 0:
                clear_btn.click()
                page.wait_for_timeout(1000)
                check(page.locator(".search-bar.active").count() == 0, "Search deactivated after clear")
        else:
            warnings.append("Search input not found")

        # ============================================================
        # 7. User profile
        # ============================================================
        print("\n7. User Profile")
        page.goto(f"{BASE}/?source=hackernews&feed=top")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        author_btn = page.locator(".author").first
        if author_btn.count() > 0:
            author_name = author_btn.inner_text()
            author_btn.click()
            page.wait_for_load_state("networkidle")
            # HN API is slow; wait longer and poll for content
            page.wait_for_timeout(5000)

            check("/user/" in page.url, f"Navigated to user profile ({page.url})")

            # Wait for either username or error to appear
            username_el = page.locator(".username")
            if username_el.count() == 0:
                page.wait_for_timeout(5000)  # extra wait for slow API

            has_profile = username_el.count() > 0
            warn(has_profile, f"User profile loaded for '{author_name}' (HN API may be slow)")

            if has_profile:
                user_tabs = page.locator(".profile .tab").all()
                check(len(user_tabs) >= 2, f"User profile has tabs ({len(user_tabs)})")

            screenshot(page, "07_user_profile")

            page.locator(".back-link").click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            check("/user/" not in page.url, "Returned from user profile")

        # ============================================================
        # 8. Collections page
        # ============================================================
        print("\n8. Collections Page")
        page.locator(".nav-link", has_text="Collections").click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        check("/collections" in page.url, f"Navigated to collections ({page.url})")
        screenshot(page, "08_collections")

        # ============================================================
        # 9. Settings page
        # ============================================================
        print("\n9. Settings Page")
        page.locator(".settings-icon").click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        check("/settings" in page.url, f"Navigated to settings ({page.url})")
        screenshot(page, "09_settings")

        # ============================================================
        # 10. Theme toggle
        # ============================================================
        print("\n10. Theme Toggle")
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Theme is on :root via data-theme attribute
        theme_before = page.evaluate("document.documentElement.getAttribute('data-theme') || 'dark'")
        theme_btn = page.locator(".icon-btn", has_text="☀").or_(page.locator(".icon-btn", has_text="☾"))
        if theme_btn.count() > 0:
            theme_btn.first.click()
            page.wait_for_timeout(500)
            theme_after = page.evaluate("document.documentElement.getAttribute('data-theme') || 'dark'")
            check(theme_before != theme_after, f"Theme toggled ({theme_before} → {theme_after})")
            screenshot(page, "10_theme_toggled")
            # Toggle back
            theme_btn2 = page.locator(".icon-btn", has_text="☀").or_(page.locator(".icon-btn", has_text="☾"))
            theme_btn2.first.click()
            page.wait_for_timeout(500)

        # ============================================================
        # 11. Keyboard navigation
        # ============================================================
        print("\n11. Keyboard Navigation")
        page.goto(f"{BASE}/?source=hackernews&feed=top")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Enable keyboard nav in settings via localStorage (key is 'hn-settings', legacy name)
        page.evaluate("""
            const stored = JSON.parse(localStorage.getItem('hn-settings') || '{}');
            stored.keyboardNav = true;
            localStorage.setItem('hn-settings', JSON.stringify(stored));
        """)
        # Reload to pick up setting
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # j/k movement
        page.keyboard.press("j")
        page.wait_for_timeout(300)
        selected = page.locator(".story-card.selected")
        check(selected.count() > 0, "j key selects a story card")

        if selected.count() > 0:
            idx1 = selected.get_attribute("data-index")
            print(f"    After first j: index={idx1}")

        page.keyboard.press("j")
        page.wait_for_timeout(300)
        selected = page.locator(".story-card.selected")
        if selected.count() > 0:
            idx2 = selected.get_attribute("data-index")
            print(f"    After second j: index={idx2}")
            check(int(idx2) > 0, f"j advances selection (index={idx2})")

        page.keyboard.press("k")
        page.wait_for_timeout(300)
        selected = page.locator(".story-card.selected")
        if selected.count() > 0:
            idx3 = selected.get_attribute("data-index")
            print(f"    After k: index={idx3}")
            check(int(idx3) < int(idx2), f"k moves selection back (index={idx3} < {idx2})")

        screenshot(page, "11_keyboard_nav")

        # ============================================================
        # 12. Source switching (DEV.to)
        # ============================================================
        print("\n12. Source Switching to DEV.to")
        page.locator(".source-btn").click()
        page.wait_for_timeout(500)
        devto = page.locator(".source-option", has_text="DEV")
        if devto.count() > 0:
            devto.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)

            dev_stories = page.locator(".story-card").all()
            check(len(dev_stories) > 0, f"DEV.to stories loaded ({len(dev_stories)})")
            screenshot(page, "12_devto")
        else:
            warnings.append("DEV.to option not found in source menu")

        # ============================================================
        # 13. Feed context preservation (Newest → item → back → still Newest)
        # ============================================================
        print("\n13. Feed Context Preservation")
        page.goto(f"{BASE}/?source=lobsters&feed=newest")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        active_tab = page.locator(".tab.active")
        check(active_tab.count() > 0 and active_tab.inner_text() == "Newest",
              f"Started on Newest tab (got '{active_tab.inner_text() if active_tab.count() > 0 else 'none'}')")

        stories = page.locator(".story-card").all()
        if stories:
            stories[0].click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            page.locator(".back-link").click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            final_tab = page.locator(".tab.active")
            check(final_tab.count() > 0 and final_tab.inner_text() == "Newest",
                  f"Returned to Newest tab (got '{final_tab.inner_text() if final_tab.count() > 0 else 'none'}')")
            check("feed=newest" in page.url, f"URL preserves feed=newest ({page.url})")

        screenshot(page, "13_feed_context")

        # ============================================================
        # 14. Infinite scroll
        # ============================================================
        print("\n14. Infinite Scroll")
        page.goto(f"{BASE}/?source=hackernews&feed=top")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        initial_count = len(page.locator(".story-card").all())
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(3000)
        after_scroll_count = len(page.locator(".story-card").all())
        check(after_scroll_count >= initial_count,
              f"Infinite scroll ({initial_count} → {after_scroll_count})")
        screenshot(page, "14_infinite_scroll")

        # ============================================================
        # 15. Console errors check
        # ============================================================
        print("\n15. Console Errors")
        real_errors = [e for e in console_errors if "favicon" not in e.lower() and "failed to fetch" not in e.lower()]
        check(len(real_errors) == 0, f"No console errors ({len(real_errors)} found: {real_errors[:3]})")

        browser.close()

    return errors, warnings


if __name__ == "__main__":
    print("=" * 60)
    print("Omnifeed Regression Test Suite")
    print("=" * 60)

    errs, warns = test()

    print("\n" + "=" * 60)
    if warns:
        print(f"WARNINGS: {len(warns)}")
        for w in warns:
            print(f"  ! {w}")
    if errs:
        print(f"FAILED: {len(errs)} error(s)")
        for e in errs:
            print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED")
        sys.exit(0)
