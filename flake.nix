{
  description = "winter-f3cb5 firebase project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: flake-utils.lib.eachDefaultSystem (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_24
          corepack_24

          typescript
          svelte-language-server
          typescript-language-server
          tailwindcss-language-server
          vscode-langservers-extracted

          firebase-tools
          jdk21_headless
        ];

        env = {
          JAVA_TOOL_OPTIONS = "-Xms512m -Xmx2g";
        };
      };
    }
  );
}
