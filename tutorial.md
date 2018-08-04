# Markdown Tutorial

## Philosophy

Markdown is intended to be as easy-to-read and easy-to-write as is feasible.
A Markdown-formatted document should be publishable as-is, as plain text, without looking like it's been marked up with tags or formatting instructions.
Markdown's syntax is comprised entirely of punctuation characters, which punctuation characters have been carefullly chosen so as to look like what they mean.

## Markdown Syntax

### Inline HTML

Makrdown is not a replacement for HTML, or even close to it. HTML is a **publishing** format; Markdown is a **writing** format.

#### Demo

	This is a regular paragraph of markdown document.
	<button>Button</button>

This is a regular paragraph of markdown document.
<button>Button</button>

---

### Automatic Escaping for Special Characters

In HTML, there are two characters that demand special treatment: < and &. If you want to use them as literal characters in HTML, you must escape them as entities, e.g. `&lt;` and `&amp;`. But, markdown allows you to use these characters naturally.

#### Demo

	The left angle bracket(<) and Ampersands(&)

The left angle bracket(<) and Ampersands(&)

---

### Paragraph

A paragraph is simply one or more consecutive lines or text, separated by one or more blank lines.

#### Demo

	This is the first paragraph.↵
	↵
	This is the second paragraph.

This is the first paragraph.

This is the second paragraph.

---

### Line Breaks

In HTML, the tag `<br />` is used to break line. When you do want to insert a `<br />` break tag using Markdown, you end a line with two or more spaces.

#### Demo

	Line bre↵
	ak here.

Line bre  
ak here.

---

### Headers

Markdown supports Atx-style headers(1-6 levels).

#### Demo

	#·Header Level 1
	##·Header Level 2
	###·Header Level 3
	####·Header Level 4

# Header Level 1
## Header Level 2
### Header Level 3
#### Header Level 4

#### Demo: Misuse

Compare the above with the below:

	#Header Level 1
	##Header Level 2
	###Header Level 3
	####Header Level 4
	
#Header Level 1
##Header Level 2
###Header Level 3
####Header Level 4

---

### Emphasis

#### Demo

	**Strong** and *Italic*

**Strong** and *Italic*

---

### Strike Through

#### Demo

	a ~~strikethrough~~ element

a ~~strikethrough~~ element

---

### Blockquotes

Markdown uses email-style > characters for blockquoting.

#### Demo

	> This is a blockquote with two paragraphs.
	> 
	> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
	>
	>> This is nested blockquote.
	>
	> Back to the first level.

> This is a blockquote with two paragraphs.
> 
> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
>
>> This is nested blockquote.
>
> Back to the first level.

---

### Lists

Markdown supports ordered and unordered lists.

#### Demo

	- Red
	- Green
	- Blue
	
	1. Red
	··- Nested Red 1
	··- Nested Red 2
	2. Green
	3. Blue

- Red
- Green
- Blue

1. Red
  - Nested Red 1
  - Nested Red 2
2. Green
3. Blue

---

### Horizontal Rules

You can produce a horizontal rule tag `<hr />` by placing three or more hyphens, asterisks, or underscores.

#### Demo

```
---
***
___
```
---
***
___

---

### Inline Links

#### Demo

```
I use [google](https://google.com/) and [naver](https://naver.com/) for information retrieval.
```
I use [google](https://google.com/) and [naver](https://naver.com/) for information retrieval.

---

### Reference-Style Links

#### Demo

	I use [google][1] and [naver][2] for information retrieval.

	[1]: https://google.com/ "Google"
	[2]: https://naver.com/ "Naver"

I use [google][1] and [naver][2] for information retrieval.

[1]: https://google.com/ "Google"
[2]: https://naver.com/ "Naver"
  
	I use [google][] and [naver][] for information retrieval.

	[google]: https://google.com/ "Google"
	[naver]: https://naver.com/ "Naver"
	
I use [google][] and [naver][] for information retrieval.

[google]: https://google.com/ "Google"
[naver]: https://naver.com/ "Naver"

---

### Images

Markdown uses an image syntax that is intended to resemble the syntax for links.

#### Demo

	![alt texts](https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png =272x*)
	![](https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png =272x80 "Optional title")

![alt texts](https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png =272x*)
![](https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png =272x80 "Optional title")

---

### Tables

Markdown has a special syntax for tables.

#### Demo

	Item     | Value
	-------- | ---
	Computer | $1600
	Phone    | $12
	Pipe     | $1

Item     | Value
-------- | ---
Computer | $1600
Phone    | $12
Pipe     | $1

You can specify column alignment with one or two colons.

	| Item     | Value | Qty   |
	| :------- | ----: | :---: |
	| Computer | $1600 |  5    |
	| Phone    | $12   |  12   |
	| Pipe     | $1    |  234  |

| Item     | Value | Qty   |
| :------- | ----: | :---: |
| Computer | $1600 |  5    |
| Phone    | $12   |  12   |
| Pipe     | $1    |  234  |

---

### Code Block

#### Demo

	⇥#include <stdio.h>
	⇥int main() {
	⇥⇥printf("Hello world!\n");
	⇥⇥return 0;
	⇥}

The tab spacing is replaced with 4 spaces:

	#include <stdio.h>
	int main() {
		printf("Hello world!\n");
		return 0;
	}

---

### Code Highlighting

#### Demo

	This is a sample code from `sample.cpp`.
	
	```cpp
	#include <stdio.h>
	int main() {
		printf("Hello world!\n");
		return 0;
	}
	```

This is a sample code from `sample.cpp`.

```cpp
#include <stdio.h>
int main() {
	printf("Hello world!\n");
	return 0;
}
```

---

### Task Lists

#### Demo

	- [x] This task is done
	- [ ] This is still pending
	
- [x] This task is done
- [ ] This is still pending

---

### Keyboard Buttons

For more HTML symbols, see [https://www.toptal.com/designers/htmlarrows/](https://www.toptal.com/designers/htmlarrows/).

#### Demo

	<kbd>⎋ Esc</kbd>
	
	<kbd>&rarrb; Tab</kbd> <kbd>↹ Tab</kbd> <kbd>&crarr; Enter</kbd> <kbd>&larrhk; Enter</kbd>
	
	<kbd>⌥ Alt</kbd> <kbd>&Hat; Ctrl</kbd> <kbd>⇧ Shift</kbd> <kbd>⇪ CapsLock</kbd> <kbd>⌘ Cmd</kbd>
	
	<kbd>&larr; Backspace</kbd> <kbd>⌫ Backspace</kbd> <kbd>␣ Spacebar</kbd>
	
	<kbd>&rarr; Right</kbd>

<kbd>⎋ Esc</kbd>

<kbd>&rarrb; Tab</kbd> <kbd>↹ Tab</kbd> <kbd>&crarr; Enter</kbd> <kbd>&larrhk; Enter</kbd>

<kbd>⌥ Alt</kbd> <kbd>&Hat; Ctrl</kbd> <kbd>⇧ Shift</kbd> <kbd>⇪ CapsLock</kbd> <kbd>⌘ Cmd</kbd>

<kbd>&larr; Backspace</kbd> <kbd>⌫ Backspace</kbd> <kbd>␣ Spacebar</kbd>

<kbd>&rarr; Right</kbd>